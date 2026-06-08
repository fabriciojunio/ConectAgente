import { useState } from 'react'
import axios from 'axios'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  async function login() {
    const res = await axios.post('http://localhost:3333/auth/login', {
      email, senha
    })

    if (res.data.user.role === 'ADMIN') {
      localStorage.setItem('token', res.data.token)
      window.location.href = '/dashboard'
    }
  }

  return (
    <>
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" onChange={e => setSenha(e.target.value)} />
      <button onClick={login}>Entrar</button>
    </>
  )
}
