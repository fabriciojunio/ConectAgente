import { Router } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from "../lib/prisma.js";
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js'

const router = Router()

// Apply authentication middleware to all routes below
router.use(authMiddleware)

// Agent routes (profile)
router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })
    const { senha, ...userWithoutPassword } = user
    res.json(userWithoutPassword)
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

// Apply Admin middleware to all routes below
router.use(adminMiddleware)

// List all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, nome: true, login: true, role: true, createdAt: true }
    })
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

// Create an Agent or Admin
router.post('/', async (req, res) => {
  const { nome, login, senha, role } = req.body
  try {
    if (!nome || !login || !senha) return res.status(400).json({ error: 'Dados inválidos' })
    
    const hash = await bcrypt.hash(senha, 10)
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'AGENTE'
    
    const newUser = await prisma.user.create({
      data: { nome, login, senha: hash, role: userRole }
    })
    const { senha: _, ...userWithoutPassword } = newUser
    res.json(userWithoutPassword)
  } catch (error) {
    res.status(500).json({ error: error.code || error.message })
  }
})

// Edit a user
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { nome, login, senha, role } = req.body
  try {
    const data = {}
    if (nome) data.nome = nome
    if (login) data.login = login
    if (role) data.role = role === 'ADMIN' ? 'ADMIN' : 'AGENTE'
    if (senha) data.senha = await bcrypt.hash(senha, 10)

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data
    })
    const { senha: _, ...userWithoutPassword } = user
    res.json(userWithoutPassword)
  } catch (error) {
    res.status(500).json({ error: error.code || error.message })
  }
})

// Delete a user
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await prisma.user.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'Usuário deletado com sucesso' })
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar' })
  }
})

export default router
