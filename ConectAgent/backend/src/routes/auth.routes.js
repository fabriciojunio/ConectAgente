import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from "../lib/prisma.js";

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const { login, senha } = req.body

    const user = await prisma.user.findUnique({ where: { login } })
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' })

    const valid = await bcrypt.compare(senha, user.senha)
    if (!valid) return res.status(401).json({ error: 'Senha inválida' })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    )

    const { senha: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

// Setup initial admin for testing (remove or secure this in production)
router.post('/setup', async (req, res) => {
  try {
    const { nome, login, senha } = req.body
    const hash = await bcrypt.hash(senha, 10)
    const admin = await prisma.user.create({
      data: { nome, login, senha: hash, role: 'ADMIN' }
    })
    res.json(admin)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.code || error.message })
  }
})

export default router
