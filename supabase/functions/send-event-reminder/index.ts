import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')

// Helper function to get Discord user info
async function getDiscordUser(discordId: string) {
  if (!DISCORD_BOT_TOKEN) {
    return { success: false, error: 'No bot token' }
  }

  try {
    const userResponse = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      },
    })

    if (!userResponse.ok) {
      const error = await userResponse.text()
      console.error('Failed to fetch Discord user:', error)
      return { success: false, error: 'Failed to fetch user' }
    }

    const user = await userResponse.json()
    // Return display name (global_name) or fallback to username
    const displayName = user.global_name || user.username
    return { success: true, displayName, user }
  } catch (error) {
    console.error('Discord user fetch error:', error)
    return { success: false, error: error.message }
  }
}

// Helper function to send Discord DM
async function sendDiscordDM(discordId: string, displayName: string, message: string) {
  if (!DISCORD_BOT_TOKEN) {
    console.warn('Discord bot token not configured, skipping Discord notification')
    return { success: false, error: 'No bot token' }
  }

  try {
    // First, create a DM channel with the user
    const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: discordId,
      }),
    })

    if (!dmChannelResponse.ok) {
      const error = await dmChannelResponse.text()
      console.error('Failed to create DM channel:', error)
      return { success: false, error: 'Failed to create DM channel' }
    }

    const dmChannel = await dmChannelResponse.json()

    // Send the message to the DM channel
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    })

    if (!messageResponse.ok) {
      const error = await messageResponse.text()
      console.error('Failed to send Discord message:', error)
      return { success: false, error: 'Failed to send message' }
    }

    return { success: true, data: await messageResponse.json() }
  } catch (error) {
    console.error('Discord DM error:', error)
    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  try {
    const { event_slug, test_discord_id } = await req.json()

    if (!event_slug) {
      return new Response(
        JSON.stringify({ error: 'event_slug is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the event by slug
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, slug')
      .eq('slug', event_slug)
      .single()

    if (eventError || !event) {
      console.error('Event not found:', eventError)
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found event: ${event.name} (${event.slug})`)

    // If test_discord_id is provided, only send to that user
    if (test_discord_id) {
      console.log(`TEST MODE: Sending only to Discord ID ${test_discord_id}`)
      
      const message = `Hi there,

We're looking forward to welcoming you to [ADOS](https://ados.events/) on Friday!

We hope that the day will be a fun day with exciting but relatively light/interactive content mixed with lots of opportunities for this weird and interesting group to get to know one another. I'm attaching the [schedule here](https://drive.google.com/file/d/1Hf9v_TID4LPp2_QWIolsdKw0GVB8p0a3/view?usp=sharing).

As per the schedule, the event will run **from 11am at [Mack Sennett Studios](https://maps.app.goo.gl/PU8M0xtuXSpYVrGsJ).** We're at capacity with a couple of people waiting so if you can't make it please [let us know](mailto:peter@omalley.io?subject=I%20can't%20make%20it%20to%20ADOS).

See you on Friday!

Peter

PS: finally, you can find a short [video](https://drive.google.com/file/d/1_PrYdtXW-5m_D95ShL7VjARLw8WfrAhk/view?usp=sharing) Hannah made to hype you up for the event/moment in history that we're at.`

      // Fetch Discord user info
      const userInfo = await getDiscordUser(test_discord_id)
      const displayName = userInfo.success ? userInfo.displayName : 'there'
      
      // Personalize the message
      const personalizedMessage = message.replace('Hi there,', `Hi ${displayName},`)
      
      // Send the message
      const discordResult = await sendDiscordDM(test_discord_id, displayName, personalizedMessage)
      
      if (!discordResult.success) {
        return new Response(
          JSON.stringify({ error: 'Failed to send Discord message', details: discordResult.error }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Test message sent successfully',
          sent_to: test_discord_id
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Production mode: get all approved attendees for this event
    const { data: attendees, error: attendeesError } = await supabase
      .from('attendance')
      .select(`
        id,
        event_reminder_sent_at,
        user_id,
        profiles!attendance_user_id_fkey (
          discord_id,
          discord_username,
          email
        )
      `)
      .eq('event_id', event.id)
      .eq('status', 'approved')

    if (attendeesError) {
      console.error('Error fetching attendees:', attendeesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attendees', details: attendeesError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!attendees || attendees.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No approved attendees found for this event', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${attendees.length} approved attendees`)

    const message = `Hi there,

We're looking forward to welcoming you to [ADOS](https://ados.events/) on Friday!

We hope that the day will be a fun day with exciting but relatively light/interactive content mixed with lots of opportunities for this weird and interesting group to get to know one another. I'm attaching the [schedule here](https://drive.google.com/file/d/1Hf9v_TID4LPp2_QWIolsdKw0GVB8p0a3/view?usp=sharing).

As per the schedule, the event will run **from 11am at [Mack Sennett Studios](https://maps.app.goo.gl/PU8M0xtuXSpYVrGsJ).** We're at capacity with a couple of people waiting so if you can't make it please [let us know](mailto:peter@omalley.io?subject=I%20can't%20make%20it%20to%20ADOS).

See you on Friday!

Peter

PS: finally, you can find a short [video](https://drive.google.com/file/d/1_PrYdtXW-5m_D95ShL7VjARLw8WfrAhk/view?usp=sharing) Hannah made to hype you up for the event/moment in history that we're at.`

    const results = []
    let successCount = 0
    let failCount = 0
    let skippedCount = 0

    for (const attendee of attendees) {
      // Skip if already sent
      if (attendee.event_reminder_sent_at) {
        console.log(`Skipping attendee ${attendee.id} - reminder already sent`)
        skippedCount++
        results.push({
          attendance_id: attendee.id,
          status: 'skipped',
          reason: 'reminder_already_sent'
        })
        continue
      }

      // Skip if no discord_id
      if (!attendee.profiles?.discord_id) {
        console.log(`Skipping attendee ${attendee.id} - no Discord ID`)
        skippedCount++
        results.push({
          attendance_id: attendee.id,
          status: 'skipped',
          reason: 'no_discord_id',
          email: attendee.profiles?.email
        })
        continue
      }

      const discordId = attendee.profiles.discord_id

      // Fetch Discord user info
      const userInfo = await getDiscordUser(discordId)
      const displayName = userInfo.success ? userInfo.displayName : 'there'
      
      // Personalize the message
      const personalizedMessage = message.replace('Hi there,', `Hi ${displayName},`)
      
      // Send the message
      const discordResult = await sendDiscordDM(discordId, displayName, personalizedMessage)
      
      if (discordResult.success) {
        console.log(`✅ Sent reminder to Discord ID ${discordId}`)
        successCount++
        
        // Mark as sent in database
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ event_reminder_sent_at: new Date().toISOString() })
          .eq('id', attendee.id)

        if (updateError) {
          console.warn(`Failed to update event_reminder_sent_at for ${attendee.id}:`, updateError)
        }

        results.push({
          attendance_id: attendee.id,
          discord_id: discordId,
          status: 'sent'
        })
      } else {
        console.error(`❌ Failed to send to Discord ID ${discordId}:`, discordResult.error)
        failCount++
        results.push({
          attendance_id: attendee.id,
          discord_id: discordId,
          status: 'failed',
          error: discordResult.error
        })
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        event: event.name,
        total_attendees: attendees.length,
        sent: successCount,
        failed: failCount,
        skipped: skippedCount,
        results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

