import { Router } from 'express'
import { prisma } from "../lib/prisma.js";
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js'

const router = Router()

// Apply authentication middleware to all form routes
router.use(authMiddleware)

// Agent: List their own submitted forms
router.get('/me', async (req, res) => {
  try {
    const forms = await prisma.formRecord.findMany({
      where: { agenteId: req.userId },
      orderBy: { createdAt: 'desc' }
    })
    res.json(forms)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar formulários' })
  }
})

// Agent: Submit a new form
router.post('/', async (req, res) => {
  const { paciente, endereco, dataVisita, observacoes } = req.body
  try {
    if (!paciente || !endereco || !dataVisita) {
      return res.status(400).json({ error: 'Campos obrigatórios: paciente, endereco, dataVisita' })
    }

    const newForm = await prisma.formRecord.create({
      data: {
        paciente,
        endereco,
        dataVisita: new Date(dataVisita),
        observacoes,
        agenteId: req.userId
      }
    })
    res.status(201).json(newForm)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Admin: View all forms from all agents
router.get('/all', adminMiddleware, async (req, res) => {
  try {
    const forms = await prisma.formRecord.findMany({
      include: {
        agente: {
          select: { nome: true, login: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(forms)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar formulários gerais' })
  }
})

export default router
