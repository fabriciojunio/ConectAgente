'use client';

import { useState } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { FilterBar } from '@/components/layout/FilterBar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { gerarRelatorio } from '@/services/relatorioService';
import {
  Loader2,
  FileText,
  FileSpreadsheet,
  File,
  ClipboardList,
  Users,
  Home,
  Shield,
  AlertTriangle,
  Download,
} from 'lucide-react';

type ReportType = 'visitas' | 'agentes' | 'familias' | 'cobertura' | 'atrasos';
type ExportFormat = 'pdf' | 'excel' | 'csv';

const reportTypes: Array<{
  type: ReportType;
  label: string;
  description: string;
  icon: typeof FileText;
  color: string;
}> = [
  { type: 'visitas', label: 'Visitas', description: 'Relatório detalhado de visitas domiciliares', icon: ClipboardList, color: 'text-primary-600 bg-primary-50' },
  { type: 'agentes', label: 'Agentes', description: 'Desempenho dos agentes comunitários', icon: Users, color: 'text-green-600 bg-green-50' },
  { type: 'familias', label: 'Famílias', description: 'Cadastro e situação das famílias', icon: Home, color: 'text-blue-600 bg-blue-50' },
  { type: 'cobertura', label: 'Cobertura', description: 'Análise de cobertura por área', icon: Shield, color: 'text-purple-600 bg-purple-50' },
  { type: 'atrasos', label: 'Atrasos', description: 'Famílias com visitas em atraso', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
];

const formatOptions: Array<{ format: ExportFormat; label: string; icon: typeof FileText }> = [
  { format: 'pdf', label: 'PDF', icon: FileText },
  { format: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { format: 'csv', label: 'CSV', icon: File },
];

export default function RelatoriosPage() {
  const { filters } = useFilters();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<Array<Record<string, unknown>> | null>(null);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);

  async function handleGenerate() {
    if (!selectedType) return;

    setLoading(true);
    setError('');
    try {
      const result = await gerarRelatorio(selectedType, selectedFormat, filters);

      if (result.preview) {
        setPreviewData(result.preview.data);
        setPreviewColumns(result.preview.columns);
      }

      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `relatorio_${selectedType}.${selectedFormat === 'excel' ? 'xlsx' : selectedFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Relatórios</h1>
        <p className="page-subtitle">Geração e exportação de relatórios</p>
      </div>

      {/* Report Type Selector */}
      <div>
        <h3 className="section-title">Tipo de Relatório</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {reportTypes.map((report) => (
            <button
              key={report.type}
              onClick={() => {
                setSelectedType(report.type);
                setPreviewData(null);
              }}
              className={`text-left rounded-xl border p-4 transition-all hover:shadow-md ${
                selectedType === report.type
                  ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg w-fit ${report.color}`}>
                <report.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-3">{report.label}</p>
              <p className="text-xs text-gray-500 mt-1">{report.description}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedType && (
        <>
          {/* Filters */}
          <FilterBar variant="relatorios" />

          {/* Format Selector */}
          <div>
            <h3 className="section-title">Formato de Exportação</h3>
            <div className="flex gap-3">
              {formatOptions.map((option) => (
                <button
                  key={option.format}
                  onClick={() => setSelectedFormat(option.format)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedFormat === option.format
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div>
            <Button onClick={handleGenerate} loading={loading} size="lg">
              <Download className="w-4 h-4 mr-2" />
              Gerar Relatório
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Preview Table */}
          {previewData && previewData.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="section-title">Pré-visualização</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {previewColumns.map((col) => (
                        <th key={col} className="text-left px-4 py-3 font-medium text-gray-600">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 20).map((row, index) => (
                      <tr key={index} className="border-b last:border-0">
                        {previewColumns.map((col) => (
                          <td key={col} className="px-4 py-3">
                            {String(row[col] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 20 && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  Mostrando 20 de {previewData.length} registros. O arquivo completo será exportado.
                </p>
              )}
            </div>
          )}

          {previewData && previewData.length === 0 && (
            <EmptyState
              title="Sem dados"
              description="Não foram encontrados dados para os filtros selecionados."
            />
          )}
        </>
      )}
    </div>
  );
}
