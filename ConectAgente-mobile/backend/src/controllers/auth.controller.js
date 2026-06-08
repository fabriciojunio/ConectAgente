import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

export async function register(req, res) {
  const { nome, email, senha, role } = req.body

  const hash = await bcrypt.hash(senha, 10)

  const user = await prisma.user.create({
    data: { nome, login: email, senha: hash, role }
  })

  res.json(user)
}

export async function login(req, res) {
  const { email, senha } = req.body

  const user = await prisma.user.findUnique({ where: { login: email } })
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' })

  const valid = await bcrypt.compare(senha, user.senha)
  if (!valid) return res.status(401).json({ error: 'Senha inválida' })

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  )

  res.json({ token, user })
}
