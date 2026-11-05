import React, { useEffect, useState } from 'react'
import { verifyEmail } from '../api'

function StandaloneMessage({ title, message }) {
  return <main className="page-section"><div className="auth-modal standalone-message"><p className="eyebrow">BORROW HUB ACCOUNT</p><h2>{title}</h2>{message && <p className="modal-copy">{message}</p>}</div></main>
}

export default function VerificationPage({ token }) {
  const [message, setMessage] = useState('Verifying your email…')
  useEffect(() => {
    verifyEmail(token)
      .then(result => setMessage(result.data.message))
      .catch(error => setMessage(error.message))
  }, [token])
  return <StandaloneMessage title="Email verification" message={message} />
}
