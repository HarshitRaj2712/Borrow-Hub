import React, { useState } from 'react'
import { resetPassword } from '../api'

function StandaloneMessage({ title, message, children }) {
  return <main className="page-section"><div className="auth-modal standalone-message"><p className="eyebrow">BORROW HUB ACCOUNT</p><h2>{title}</h2>{message && <p className="modal-copy">{message}</p>}{children}</div></main>
}

export default function ResetPasswordPage({ token }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const submit = async event => {
    event.preventDefault()
    try {
      const result = await resetPassword(token, password)
      setMessage(result.data.message)
    } catch (error) {
      setMessage(error.message)
    }
  }
  return <StandaloneMessage title="Choose a new password" message={message}><form className="auth-form" onSubmit={submit}><label>New password<input required minLength="8" type="password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="button primary full">Reset password</button></form></StandaloneMessage>
}
