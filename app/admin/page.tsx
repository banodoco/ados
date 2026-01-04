'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowLeft, Copy, Check, Download, Search } from 'lucide-react'
import Link from 'next/link'

export default function AdminPage() {
  const router = useRouter()
  // Create client lazily to avoid issues during SSR/prerendering
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null
    return createClient()
  }, [])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [maxUses, setMaxUses] = useState('5')
  const [discordId, setDiscordId] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [invites, setInvites] = useState<any[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [attendees, setAttendees] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [bulkInput, setBulkInput] = useState('')
  const [bulkResults, setBulkResults] = useState<any[]>([])
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'invites' | 'attendees'>('attendees')

  useEffect(() => {
    if (!supabase) return
    
    // Capture non-null supabase for TypeScript
    const client = supabase
    
    async function checkAdmin() {
      const { data: { user } } = await client.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      const { data: profile } = await client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/')
        return
      }

      setIsAdmin(true)
      setLoading(false)
      
      // Load existing invites and attendees
      loadInvites()
      loadAttendees()
    }

    checkAdmin()
  }, [router, supabase])

  const loadInvites = async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setInvites(data)
    }
  }

  const loadAttendees = async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        profiles!attendance_user_id_fkey(
          email,
          discord_username,
          discord_handle,
          avatar_url
        ),
        events(name, slug),
        answers!answers_attendance_id_fkey(
          id,
          answer_text,
          questions(question_text)
        )
      `)
      .order('applied_at', { ascending: false })
    
    console.log('Load attendees data:', data)
    console.log('Load attendees error:', error)
    
    if (!error && data) {
      setAttendees(data)
    }
  }

  const updateAttendeeStatus = async (attendanceId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!supabase) return
    setUpdatingStatus(attendanceId)
    
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: newStatus })
        .eq('id', attendanceId)
      
      if (error) throw error
      
      // Reload attendees
      await loadAttendees()
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const generateCode = () => {
    // Generate a random code if custom code is empty
    const randomCode = name.toUpperCase().replace(/\s+/g, '') + Math.random().toString(36).substring(2, 6).toUpperCase()
    return randomCode
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const code = customCode.trim() || generateCode()
      const uses = parseInt(maxUses)

      if (!name.trim()) {
        setError('Name is required')
        setIsSubmitting(false)
        return
      }

      if (uses < 1) {
        setError('Number of uses must be at least 1')
        setIsSubmitting(false)
        return
      }

      // Create the invite
      const inviteData: any = {
        code: code,
        name: name.trim(),
        max_uses: uses,
        used_count: 0,
      }
      
      // Add discord_id if provided
      if (discordId.trim()) {
        inviteData.discord_id = discordId.trim()
      }
      
      if (!supabase) return
      const { error: inviteError } = await supabase
        .from('invites')
        .insert(inviteData)

      if (inviteError) {
        if (inviteError.message.includes('duplicate')) {
          setError('This invite code already exists. Try a different code.')
        } else {
          setError(inviteError.message)
        }
        setIsSubmitting(false)
        return
      }

      // Generate the shareable URL
      const url = `${window.location.origin}/?invite=${code}`
      setGeneratedUrl(url)
      
      // Reload invites to show the new one at the top
      await loadInvites()
      
      // Reset form
      setName('')
      setCustomCode('')
      setMaxUses('5')
      setDiscordId('')
    } catch (err) {
      console.error('Error creating invite:', err)
      setError('Failed to create invite')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = async (url?: string, id?: string) => {
    try {
      const textToCopy = url || generatedUrl
      await navigator.clipboard.writeText(textToCopy)
      
      if (id) {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      } else {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setIsBulkSubmitting(true)
    setBulkResults([])

    try {
      // Parse the CSV input: username,discord_id
      const lines = bulkInput.trim().split('\n')
      const results: any[] = []

      for (const line of lines) {
        if (!line.trim()) continue

        const [username, discord_id] = line.split(',').map(s => s.trim())
        
        if (!username || !discord_id) {
          results.push({ 
            name: username || 'Unknown', 
            success: false, 
            error: 'Invalid format. Expected: username,discord_id' 
          })
          continue
        }

        // Generate code from username
        const code = username.toUpperCase().replace(/[^A-Z0-9]/g, '') + Math.random().toString(36).substring(2, 4).toUpperCase()

        // Create the invite
        const { error: inviteError } = await supabase
          .from('invites')
          .insert({
            code,
            name: username,
            max_uses: 1,
            used_count: 0,
            discord_id,
          })

        if (inviteError) {
          results.push({ 
            name: username, 
            success: false, 
            error: inviteError.message 
          })
        } else {
          results.push({ 
            name: username, 
            code,
            success: true,
            url: `${window.location.origin}/?invite=${code}`
          })
        }

        // Add 200ms delay between invites to respect Discord API rate limits
        // This allows ~5 invites per second, well within Discord's limits
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setBulkResults(results)
      await loadInvites()
      
      // Clear input if all successful
      if (results.every(r => r.success)) {
        setBulkInput('')
      }
    } catch (err) {
      console.error('Error creating bulk invites:', err)
      setError('Failed to create bulk invites')
    } finally {
      setIsBulkSubmitting(false)
    }
  }

  const filterAttendees = (attendeesList: any[]) => {
    // First filter by status
    let filtered = attendeesList.filter(a => 
      statusFilter === 'all' ? true : a.status === statusFilter
    )

    // Then filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(attendee => {
        // Search across all relevant fields including answers
        const basicFields = [
          attendee.profiles?.discord_username || '',
          attendee.profiles?.discord_handle || '',
          attendee.profiles?.email || '',
          attendee.events?.name || '',
          attendee.status || '',
          attendee.invite_code || '',
          new Date(attendee.applied_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        ]

        // Add all answer texts to searchable content
        const answerTexts = (attendee.answers || []).map((answer: any) => 
          answer.answer_text || ''
        )

        const searchableText = [...basicFields, ...answerTexts].join(' ').toLowerCase()

        return searchableText.includes(query)
      })
    }

    return filtered
  }

  const downloadAttendees = () => {
    // Filter attendees based on current status filter and search
    const filteredAttendees = filterAttendees(attendees)

    if (filteredAttendees.length === 0) {
      alert('No attendees to download')
      return
    }

    // Create CSV content
    const csvHeaders = ['Display Name', 'Discord Handle', 'Email', 'Event', 'Status', 'Invite Code', 'Applied At']
    
    const csvRows = filteredAttendees.map(attendee => {
      return [
        attendee.profiles?.discord_username || '',
        attendee.profiles?.discord_handle ? `@${attendee.profiles.discord_handle}` : '',
        attendee.profiles?.email || '',
        attendee.events?.name || '',
        attendee.status || '',
        attendee.invite_code || '',
        new Date(attendee.applied_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    })

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n')

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `attendees-${statusFilter}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Admin</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('attendees')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'attendees'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Attendees ({attendees.length})
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'invites'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Invites ({invites.length})
          </button>
        </div>

        {activeTab === 'attendees' && (
          <>
            {/* Attendee Management */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Manage Attendees</h2>
                <Button
                  onClick={downloadAttendees}
                  variant="secondary"
                  className="flex items-center gap-2"
                  disabled={filterAttendees(attendees).length === 0}
                >
                  <Download size={16} />
                  Download {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Button>
              </div>
              
              {/* Status Filter */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {['pending', 'approved', 'rejected', 'all'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg font-semibold capitalize transition-colors ${
                      statusFilter === status
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                    <span className="ml-2 text-sm opacity-75">
                      ({attendees.filter(a => status === 'all' ? true : a.status === status).length})
                    </span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="mb-6 relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, event, status, invite code, or answers..."
                    className="pl-10"
                  />
                </div>
                {searchQuery && (
                  <p className="text-sm text-gray-600 mt-2">
                    Showing {filterAttendees(attendees).length} of {attendees.filter(a => statusFilter === 'all' ? true : a.status === statusFilter).length} {statusFilter !== 'all' && statusFilter} attendees
                  </p>
                )}
              </div>

              {/* Attendees List */}
              <div className="space-y-4">
                {filterAttendees(attendees)
                  .map((attendee) => (
                      <div key={attendee.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex gap-4">
                          {attendee.profiles?.avatar_url && (
                            <img 
                              src={attendee.profiles.avatar_url} 
                              alt={attendee.profiles.discord_username || 'User'} 
                              className="w-12 h-12 rounded-full"
                            />
                          )}
                          <div>
                            {(attendee.profiles?.discord_username || attendee.profiles?.discord_handle) && (
                              <>
                                <h3 className="font-semibold text-gray-900">
                                  {attendee.profiles.discord_username || attendee.profiles.discord_handle || 'Discord User'}
                                </h3>
                                {attendee.profiles?.discord_handle && (
                                  <div className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
                                    </svg>
                                    <p className="text-sm text-indigo-600 font-medium">
                                      @{attendee.profiles.discord_handle}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                            <p className="text-sm text-gray-600">{attendee.profiles?.email}</p>
                            {attendee.events && (
                              <p className="text-xs text-purple-600 mt-1">
                                Event: <span className="font-semibold">{attendee.events.name}</span>
                              </p>
                            )}
                            {attendee.invite_code && (
                              <p className="text-xs text-blue-600 mt-1">
                                Invited via: <span className="font-mono">{attendee.invite_code}</span>
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              Applied {new Date(attendee.applied_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            attendee.status === 'approved' ? 'bg-green-100 text-green-800' :
                            attendee.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {attendee.status}
                          </span>
                          
                          {attendee.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => updateAttendeeStatus(attendee.id, 'approved')}
                                disabled={updatingStatus === attendee.id}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {updatingStatus === attendee.id ? '...' : 'Approve'}
                              </Button>
                              <Button
                                onClick={() => updateAttendeeStatus(attendee.id, 'rejected')}
                                disabled={updatingStatus === attendee.id}
                                size="sm"
                                variant="secondary"
                                className="bg-red-100 hover:bg-red-200 text-red-700"
                              >
                                {updatingStatus === attendee.id ? '...' : 'Reject'}
                              </Button>
                            </div>
                          )}
                          
                          {attendee.status !== 'pending' && (
                            <Button
                              onClick={() => updateAttendeeStatus(attendee.id, 'pending')}
                              disabled={updatingStatus === attendee.id}
                              size="sm"
                              variant="secondary"
                            >
                              Reset to Pending
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Show answers for pending and approved applications - Full width below */}
                      {(attendee.status === 'pending' || attendee.status === 'approved') && attendee.answers && attendee.answers.length > 0 && (
                        <div className="pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Responses:</h4>
                          <div className="space-y-3">
                            {attendee.answers.map((answer: any) => (
                              <div key={answer.id} className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs font-semibold text-gray-600 mb-1">
                                  {answer.questions?.question_text || 'Question'}
                                </p>
                                <p className="text-sm text-gray-900">
                                  {answer.answer_text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                
                {filterAttendees(attendees).length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    {searchQuery 
                      ? `No attendees found matching "${searchQuery}"`
                      : `No ${statusFilter !== 'all' ? statusFilter : ''} attendees found`
                    }
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'invites' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Invite</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Person's Name *
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nathan Shipley"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Custom Invite Code (optional)
              </label>
              <Input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="NATHAN2025 (leave empty for auto-generated)"
              />
              <p className="text-xs text-gray-500 mt-1">
                If empty, a code will be auto-generated
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Number of Uses *
              </label>
              <Input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Discord ID (optional)
              </label>
              <Input
                type="text"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="123456789012345678"
              />
              <p className="text-xs text-gray-500 mt-1">
                To send a Discord invite notification. Enable Developer Mode in Discord, right-click the user, and select "Copy User ID"
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="w-full"
            >
              {isSubmitting ? 'Creating...' : 'Create Invite'}
            </Button>
          </form>

          {generatedUrl && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 mb-3">
                ✓ Invite Created!
              </h3>
              <p className="text-sm text-green-800 mb-3">
                Share this link with the person:
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={generatedUrl}
                  readOnly
                  className="flex-1"
                />
                <Button
                  onClick={() => copyToClipboard()}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Invite Creation */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulk Create Invites</h2>
          <form onSubmit={handleBulkSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Paste CSV (username,discord_id)
              </label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={'voxJT,240166269607870464\nhuemin,474070326192504842\nhu,978367254431408142'}
                className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                One per line. Format: username,discord_id (will send Discord invites automatically)
              </p>
            </div>

            <Button
              type="submit"
              disabled={isBulkSubmitting || !bulkInput.trim()}
              size="lg"
              className="w-full"
            >
              {isBulkSubmitting ? 'Creating Invites...' : 'Create Bulk Invites'}
            </Button>
          </form>

          {bulkResults.length > 0 && (
            <div className="mt-8 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Results ({bulkResults.filter(r => r.success).length}/{bulkResults.length} successful)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {bulkResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      result.success
                        ? 'bg-green-50 border border-green-200 text-green-900'
                        : 'bg-red-50 border border-red-200 text-red-900'
                    }`}
                  >
                    <div className="font-semibold">
                      {result.success ? '✓' : '✗'} {result.name}
                    </div>
                    {result.success ? (
                      <div className="text-xs mt-1">
                        Code: {result.code} • Discord invite sent
                      </div>
                    ) : (
                      <div className="text-xs mt-1">{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* List of existing invites */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Existing Invites</h2>
          
          {invites.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No invites created yet</p>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => {
                const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${invite.code}`
                const usagePercent = (invite.used_count / invite.max_uses) * 100
                
                return (
                  <div key={invite.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{invite.name}</h3>
                        <p className="text-sm text-gray-500 font-mono">{invite.code}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${invite.used_count >= invite.max_uses ? 'text-red-600' : 'text-green-600'}`}>
                          {invite.used_count} / {invite.max_uses} uses
                        </span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full transition-all ${invite.used_count >= invite.max_uses ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Input
                        type="text"
                        value={url}
                        readOnly
                        className="flex-1 text-sm"
                      />
                      <Button
                        onClick={() => copyToClipboard(url, invite.id)}
                        variant="secondary"
                        className="flex items-center gap-2"
                      >
                        {copiedId === invite.id ? (
                          <>
                            <Check size={16} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-2">
                      Created {new Date(invite.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  )
}

