import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Os formulários de cadastro são rotas escondidas das abas: a tela continua
 * montada depois que o agente sai dela. Sem zerar ao abrir, "Nova residência"
 * voltava com o endereço da casa anterior e "Novo morador" ficava preso na
 * residência da primeira abertura. Achado no aparelho, não em teste.
 */
const FORMULARIOS = ['residencia/nova.tsx', 'morador/novo.tsx', 'visita/nova.tsx'];

describe('formulários de cadastro', () => {
  it.each(FORMULARIOS)('%s zera os campos toda vez que a tela abre', (arquivo) => {
    const fonte = readFileSync(join(__dirname, '..', '(app)', arquivo), 'utf8');
    const colapsado = fonte.replace(/\s+/g, ' ');
    expect(colapsado).toMatch(/useFocusEffect\( useCallback\(\(\) => \{ reset\(/);
  });
});
