import { useMemo, useState } from 'react'
import './App.css'

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

const prettyDate = (value) => {
  if (!value || value.length !== 8) return value || '-'
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function TreeNode({ node }) {
  const [open, setOpen] = useState(true)
  const hasChildren = (node.children || []).length > 0

  return (
    <div className="tree-node">
      <button type="button" className="tree-toggle" onClick={() => setOpen((state) => !state)}>
        {hasChildren ? (open ? '▾' : '▸') : '•'} {node.name}
      </button>

      {node.segment && (
        <div className="segment-pill">
          <strong>{node.segment.id}</strong>
          <span>#{node.segment.index}</span>
          <span>{node.segment.elements.join(' | ')}</span>
        </div>
      )}

      {open && hasChildren && (
        <div className="tree-children">
          {node.children.map((child, index) => (
            <TreeNode key={`${child.name}-${index}`} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [question, setQuestion] = useState('Explain the top three errors and what to fix first.')
  const [chat, setChat] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  const issues = useMemo(() => {
    if (!result) return []
    return [...(result.errors || []), ...(result.warnings || [])]
  }, [result])

  const uploadFile = async (file) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)

    setUploading(true)
    setUploadError('')

    try {
      const res = await fetch(`${apiBase}/edi/upload`, { method: 'POST', body })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message || 'Upload failed')
      setResult(payload)
      setChat([])
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const onPickFile = (event) => {
    const [file] = event.target.files || []
    uploadFile(file)
  }

  const applySuggestion = async (issue) => {
    if (!issue.suggestion || !result?.documentId) return

    try {
      const res = await fetch(`${apiBase}/edi/apply-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: result.documentId,
          suggestion: issue.suggestion,
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message || 'Failed to apply fix')
      setResult(payload)
    } catch (error) {
      setUploadError(error.message)
    }
  }

  const askAssistant = async () => {
    if (!question.trim() || !result) return
    const userMessage = { role: 'user', text: question }
    setChat((prev) => [...prev, userMessage])
    setQuestion('')
    setChatLoading(true)

    try {
      const res = await fetch(`${apiBase}/edi/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.text,
          context: {
            transactionType: result.transactionType,
            metadata: result.envelopeMetadata,
            issues: issues.slice(0, 30),
          },
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.message || 'Assistant failed')
      setChat((prev) => [...prev, { role: 'assistant', text: payload.answer }])
    } catch (error) {
      setChat((prev) => [...prev, { role: 'assistant', text: `Error: ${error.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>edith</h1>
          <p>US Healthcare X12 837/835/834 Parser, Validator, and AI Copilot</p>
        </div>
        <label className="upload-btn">
          <input type="file" accept=".edi,.txt,.dat,.x12" onChange={onPickFile} disabled={uploading} />
          {uploading ? 'Uploading...' : 'Upload EDI File'}
        </label>
      </header>

      {uploadError && <div className="error-banner">{uploadError}</div>}

      {!result && (
        <section className="empty-state">
          <h2>Execution Flow</h2>
          <p>Ingest → Interpret → Validate → Explain → Correct & Revalidate → Summarize</p>
          <p>Upload any 837P, 837I, 835, or 834 EDI file in edith.</p>
        </section>
      )}

      {result && (
        <>
          <section className="meta-grid">
            <div className="card">
              <h2>Detected Transaction</h2>
              <p className="value">{result.transactionType}</p>
            </div>
            <div className="card">
              <h2>Envelope Metadata</h2>
              <ul>
                <li>Sender: {result.envelopeMetadata.senderId || '-'}</li>
                <li>Receiver: {result.envelopeMetadata.receiverId || '-'}</li>
                <li>Date: {prettyDate(result.envelopeMetadata.interchangeDate)}</li>
                <li>GS: {result.envelopeMetadata.functionalGroup || '-'}</li>
                <li>TX Count: {result.envelopeMetadata.transactionSetCount || 0}</li>
              </ul>
            </div>
            <div className="card">
              <h2>Validation Snapshot</h2>
              <ul>
                <li>Errors: {result.errors?.length || 0}</li>
                <li>Warnings: {result.warnings?.length || 0}</li>
                <li>Segments: {result.parsed?.segments?.length || 0}</li>
              </ul>
            </div>
          </section>

          <section className="panel-grid">
            <div className="card large">
              <h2>Parsed Structure</h2>
              <div className="tree-wrap">
                <TreeNode node={result.hierarchy} />
              </div>
            </div>

            <div className="card large">
              <h2>Issues and Fix Assistant</h2>
              <div className="issues-wrap">
                {issues.length === 0 && <p>No issues found. File looks valid.</p>}
                {issues.map((issue) => (
                  <div key={issue.id} className={`issue ${issue.severity}`}>
                    <div>
                      <strong>{issue.code}</strong> · {issue.segmentId}
                      {issue.elementPosition ? `-E${issue.elementPosition}` : ''}
                    </div>
                    <p>{issue.message}</p>
                    {issue.suggestion && (
                      <button type="button" onClick={() => applySuggestion(issue)}>
                        Apply Suggested Fix
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {result.transactionType === '835' && (
            <section className="card">
              <h2>835 Remittance Summary</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Claim ID</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Patient Resp.</th>
                      <th>Payer Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.summaries?.remittance835 || []).map((row, index) => (
                      <tr key={`${row.claimId}-${index}`}>
                        <td>{row.claimId || '-'}</td>
                        <td>{Number(row.billedAmount || 0).toFixed(2)}</td>
                        <td>{Number(row.paidAmount || 0).toFixed(2)}</td>
                        <td>{Number(row.patientResponsibility || 0).toFixed(2)}</td>
                        <td>{row.checkOrEftReference || row.payerClaimControlNumber || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {result.transactionType === '834' && (
            <section className="card">
              <h2>834 Member Enrollment Summary</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member ID</th>
                      <th>Maintenance</th>
                      <th>Relationship</th>
                      <th>Policy</th>
                      <th>Effective</th>
                      <th>Termination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.summaries?.members834 || []).map((member, index) => (
                      <tr key={`${member.memberId}-${index}`}>
                        <td>{member.memberId || '-'}</td>
                        <td>
                          <span className="badge">{member.maintenanceType || '-'}</span>
                        </td>
                        <td>{member.relationshipCode || '-'}</td>
                        <td>{member.policyNumber || '-'}</td>
                        <td>{prettyDate(member.effectiveDate)}</td>
                        <td>{prettyDate(member.terminationDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card">
            <h2>edith AI Copilot</h2>
            <div className="chat-log">
              {chat.length === 0 && <p>Ask contextual questions about this EDI file.</p>}
              {chat.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  <strong>{message.role === 'user' ? 'You' : 'edith'}:</strong> {message.text}
                </div>
              ))}
            </div>
            <div className="chat-controls">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about an error, segment, or required fix"
              />
              <button type="button" onClick={askAssistant} disabled={chatLoading || !result}>
                {chatLoading ? 'Thinking...' : 'Ask'}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default App
