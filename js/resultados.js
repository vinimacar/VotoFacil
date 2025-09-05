// resultados.js - Lógica de apuração

document.addEventListener('DOMContentLoaded', () => {
  // Referências aos elementos do DOM
  const eleicaoSelector = document.getElementById('eleicao-selector');
  const graficoVotos = document.getElementById('grafico-votos');
  const tabelaResultados = document.getElementById('tabela-resultados');
  const rankingCandidatos = document.getElementById('ranking-candidatos');
  const totalVotos = document.getElementById('total-votos');
  const totalEleitores = document.getElementById('total-eleitores');
  const percentualParticipacao = document.getElementById('percentual-participacao');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnExportExcel = document.getElementById('btn-export-excel');
  const btnFinalizar = document.getElementById('btn-finalizar');
  
  // Estado da aplicação
  let eleicoes = [];
  let candidatos = [];
  let resultados = [];
  let eleicaoAtual = null;
  let chart = null;
  
  // Dados para estatísticas
  let votosValidos = 0;
  let votosBrancos = 0;
  let totalEleitoresVotantes = 0;
  let totalEleitoresTotais = 0;
  
  // Cores para o gráfico
  const chartColors = [
    '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0',
    '#4895ef', '#560bad', '#b5179e', '#f15bb5', '#00bbf9',
    '#38b000', '#9d4edd', '#ff9e00', '#ff0054', '#390099'
  ];
  
  // Inicialização
  init();
  
  function init() {
    // Carregar eleições
    loadEleicoes().then(() => {
      // Event listeners
      setupEventListeners();
    });
  }
  
  function setupEventListeners() {
    // Seletor de eleição
    if (eleicaoSelector) {
      eleicaoSelector.addEventListener('change', handleEleicaoChange);
    }
    
    // Botões de exportação
    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', exportPDF);
    }
    
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', exportExcel);
    }
    
    // Botão de finalizar eleição
    if (btnFinalizar) {
      btnFinalizar.addEventListener('click', finalizarEleicao);
    }
  }
  
  // ===== Carregamento de Dados =====
  
  async function loadEleicoes() {
    try {
      showLoader('Carregando eleições...');
      
      const snapshot = await db.collection('eleicoes').get();
      
      eleicoes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Preencher seletor de eleições
      populateEleicaoSelector();
      
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Erro ao carregar eleições:', error);
      showNotification('Erro ao carregar eleições: ' + error.message, 'error');
      
      // Tentar carregar do IndexedDB se estiver offline
      try {
        eleicoes = await offlineManager.getOfflineData('elections');
        populateEleicaoSelector();
      } catch (err) {
        console.error('Erro ao carregar eleições offline:', err);
      }
    }
  }
  
  async function loadCandidatos(eleicaoId) {
    try {
      showLoader('Carregando candidatos...');
      
      const snapshot = await db.collection('candidatos')
        .where('eleicaoId', '==', eleicaoId)
        .get();
      
      candidatos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        votos: 0 // Inicializar contagem de votos
      }));
      
      // Ordenar por número
      candidatos.sort((a, b) => a.numero - b.numero);
      
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Erro ao carregar candidatos:', error);
      showNotification('Erro ao carregar candidatos: ' + error.message, 'error');
      
      // Tentar carregar do IndexedDB se estiver offline
      try {
        const allCandidates = await offlineManager.getOfflineData('candidates');
        candidatos = allCandidates
          .filter(c => c.eleicaoId === eleicaoId)
          .map(c => ({...c, votos: 0}));
        candidatos.sort((a, b) => a.numero - b.numero);
      } catch (err) {
        console.error('Erro ao carregar candidatos offline:', err);
      }
    }
  }
  
  async function loadEleitores(eleicaoId) {
    try {
      showLoader('Carregando informações de eleitores...');
      
      const snapshot = await db.collection('eleitores')
        .where('eleicaoId', '==', eleicaoId)
        .get();
      
      const eleitores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Contar total de eleitores e eleitores que votaram
      totalEleitoresTotais = eleitores.length;
      totalEleitoresVotantes = eleitores.filter(e => e.votou).length;
      
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Erro ao carregar eleitores:', error);
      
      // Tentar carregar do IndexedDB se estiver offline
      try {
        const allVoters = await offlineManager.getOfflineData('voters');
        const eleitores = allVoters.filter(e => e.eleicaoId === eleicaoId);
        
        totalEleitoresTotais = eleitores.length;
        totalEleitoresVotantes = eleitores.filter(e => e.votou).length;
      } catch (err) {
        console.error('Erro ao carregar eleitores offline:', err);
      }
    }
  }
  
  async function loadVotos(eleicaoId) {
    try {
      showLoader('Carregando votos...');
      
      const snapshot = await db.collection('votos')
        .where('eleicaoId', '==', eleicaoId)
        .get();
      
      const votos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Contar votos por candidato
      votosValidos = 0;
      votosBrancos = 0;
      
      votos.forEach(voto => {
        if (voto.votoBranco) {
          votosBrancos++;
        } else if (voto.candidatoId) {
          votosValidos++;
          const candidato = candidatos.find(c => c.id === voto.candidatoId);
          if (candidato) {
            candidato.votos = (candidato.votos || 0) + 1;
          }
        }
      });
      
      // Ordenar candidatos por número de votos (decrescente)
      candidatos.sort((a, b) => b.votos - a.votos);
      
      hideLoader();
      
      // Renderizar resultados
      renderResultados();
    } catch (error) {
      hideLoader();
      console.error('Erro ao carregar votos:', error);
      showNotification('Erro ao carregar votos: ' + error.message, 'error');
    }
  }
  
  // ===== Renderização de UI =====
  
  function populateEleicaoSelector() {
    if (!eleicaoSelector) return;
    
    eleicaoSelector.innerHTML = '<option value="" selected disabled>Selecione uma eleição</option>';
    
    eleicoes.forEach(eleicao => {
      eleicaoSelector.innerHTML += `<option value="${eleicao.id}">${eleicao.nome}</option>`;
    });
  }
  
  function renderResultados() {
    // Atualizar estatísticas
    updateEstatsPanel();
    
    // Renderizar gráfico
    renderChart();
    
    // Renderizar ranking
    renderRanking();
    
    // Renderizar tabela de resultados
    renderTable();
  }
  
  function updateEstatsPanel() {
    const totalVotosComputados = votosValidos + votosBrancos;
    
    if (totalVotos) {
      totalVotos.textContent = totalVotosComputados;
    }
    
    if (totalEleitores) {
      totalEleitores.textContent = totalEleitoresTotais;
    }
    
    if (percentualParticipacao) {
      const participacao = totalEleitoresTotais > 0 
        ? ((totalEleitoresVotantes / totalEleitoresTotais) * 100).toFixed(1) 
        : 0;
      percentualParticipacao.textContent = `${participacao}%`;
    }
  }
  
  function renderChart() {
    if (!graficoVotos) return;
    
    // Destruir gráfico anterior se existir
    if (chart) {
      chart.destroy();
    }
    
    // Preparar dados para o gráfico
    const labels = candidatos.map(c => c.nome);
    const data = candidatos.map(c => c.votos);
    
    // Adicionar votos em branco
    if (votosBrancos > 0) {
      labels.push('Votos em Branco');
      data.push(votosBrancos);
    }
    
    // Criar gráfico
    chart = new Chart(graficoVotos, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: chartColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map(function(label, i) {
                    const meta = chart.getDatasetMeta(0);
                    const style = meta.controller.getStyle(i);
                    const value = data.datasets[0].data[i];
                    const total = data.datasets[0].data.reduce((acc, val) => acc + val, 0);
                    const percentage = ((value / total) * 100).toFixed(1) + '%';
                    
                    return {
                      text: `${label} (${value} votos - ${percentage})`,
                      fillStyle: style.backgroundColor,
                      strokeStyle: style.borderColor,
                      lineWidth: style.borderWidth,
                      hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} votos (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  function renderRanking() {
    if (!rankingCandidatos) return;
    
    rankingCandidatos.innerHTML = '';
    
    // Criar lista de ranking
    const list = document.createElement('div');
    list.className = 'list-group';
    
    // Obter total de votos
    const totalVotosComputados = votosValidos + votosBrancos;
    
    // Adicionar cada candidato ao ranking
    candidatos.forEach((candidato, index) => {
      const percentual = totalVotosComputados > 0 
        ? ((candidato.votos / totalVotosComputados) * 100).toFixed(1) 
        : 0;
      
      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center';
      
      // Medalha para os 3 primeiros
      let medalha = '';
      if (index === 0) {
        medalha = '<span class="medal gold"><i class="fas fa-medal"></i></span>';
      } else if (index === 1) {
        medalha = '<span class="medal silver"><i class="fas fa-medal"></i></span>';
      } else if (index === 2) {
        medalha = '<span class="medal bronze"><i class="fas fa-medal"></i></span>';
      }
      
      item.innerHTML = `
        <div class="d-flex align-items-center">
          ${medalha}
          <div class="ms-3">
            <h6 class="mb-0">${candidato.nome}</h6>
            <small class="text-muted">Número: ${candidato.numero}</small>
          </div>
        </div>
        <div class="text-end">
          <h5 class="mb-0">${candidato.votos} ${candidato.votos === 1 ? 'voto' : 'votos'}</h5>
          <small class="text-muted">${percentual}%</small>
        </div>
      `;
      
      list.appendChild(item);
    });
    
    // Adicionar votos em branco ao ranking
    if (votosBrancos > 0) {
      const percentual = totalVotosComputados > 0 
        ? ((votosBrancos / totalVotosComputados) * 100).toFixed(1) 
        : 0;
      
      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center bg-light';
      
      item.innerHTML = `
        <div>
          <h6 class="mb-0">Votos em Branco</h6>
        </div>
        <div class="text-end">
          <h5 class="mb-0">${votosBrancos} ${votosBrancos === 1 ? 'voto' : 'votos'}</h5>
          <small class="text-muted">${percentual}%</small>
        </div>
      `;
      
      list.appendChild(item);
    }
    
    rankingCandidatos.appendChild(list);
  }
  
  function renderTable() {
    if (!tabelaResultados) return;
    
    tabelaResultados.innerHTML = '';
    
    // Obter total de votos
    const totalVotosComputados = votosValidos + votosBrancos;
    
    // Adicionar cada candidato à tabela
    candidatos.forEach(candidato => {
      const percentual = totalVotosComputados > 0 
        ? ((candidato.votos / totalVotosComputados) * 100).toFixed(1) 
        : 0;
      
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>
          <img src="${candidato.fotoUrl || 'https://via.placeholder.com/40'}" alt="${candidato.nome}" class="img-fluid rounded-circle" style="width: 40px; height: 40px; object-fit: cover;">
        </td>
        <td>${candidato.numero}</td>
        <td>${candidato.nome}</td>
        <td>${candidato.votos}</td>
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar" role="progressbar" style="width: ${percentual}%;" aria-valuenow="${percentual}" aria-valuemin="0" aria-valuemax="100">${percentual}%</div>
          </div>
        </td>
      `;
      
      tabelaResultados.appendChild(row);
    });
    
    // Adicionar votos em branco à tabela
    if (votosBrancos > 0) {
      const percentual = totalVotosComputados > 0 
        ? ((votosBrancos / totalVotosComputados) * 100).toFixed(1) 
        : 0;
      
      const row = document.createElement('tr');
      row.className = 'table-light';
      
      row.innerHTML = `
        <td>
          <i class="fas fa-ban text-muted" style="font-size: 1.5rem;"></i>
        </td>
        <td>-</td>
        <td>Votos em Branco</td>
        <td>${votosBrancos}</td>
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar bg-secondary" role="progressbar" style="width: ${percentual}%;" aria-valuenow="${percentual}" aria-valuemin="0" aria-valuemax="100">${percentual}%</div>
          </div>
        </td>
      `;
      
      tabelaResultados.appendChild(row);
    }
  }
  
  // ===== Handlers =====
  
  async function handleEleicaoChange(e) {
    const eleicaoId = e.target.value;
    if (!eleicaoId) return;
    
    eleicaoAtual = eleicaoId;
    
    // Carregar candidatos e votos
    await loadCandidatos(eleicaoId);
    await loadEleitores(eleicaoId);
    await loadVotos(eleicaoId);
  }
  
  async function finalizarEleicao() {
    if (!eleicaoAtual) {
      showNotification('Selecione uma eleição para finalizar', 'error');
      return;
    }
    
    if (!confirm('Tem certeza que deseja finalizar esta eleição? Isso impedirá novos votos.')) {
      return;
    }
    
    try {
      showLoader('Finalizando eleição...');
      
      // Atualizar status da eleição
      await db.collection('eleicoes').doc(eleicaoAtual).update({
        ativa: false,
        finalizadaEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Atualizar eleição na lista local
      const eleicaoIndex = eleicoes.findIndex(e => e.id === eleicaoAtual);
      if (eleicaoIndex !== -1) {
        eleicoes[eleicaoIndex].ativa = false;
        eleicoes[eleicaoIndex].finalizadaEm = new Date();
      }
      
      hideLoader();
      showNotification('Eleição finalizada com sucesso!', 'success');
      
      // Gerar relatório final
      exportPDF();
    } catch (error) {
      hideLoader();
      console.error('Erro ao finalizar eleição:', error);
      showNotification('Erro ao finalizar eleição: ' + error.message, 'error');
    }
  }
  
  // ===== Exportação =====
  
  function exportPDF() {
    if (!eleicaoAtual) {
      showNotification('Selecione uma eleição para exportar', 'error');
      return;
    }
    
    try {
      showLoader('Gerando PDF...');
      
      // Obter informações da eleição
      const eleicao = eleicoes.find(e => e.id === eleicaoAtual);
      if (!eleicao) {
        throw new Error('Eleição não encontrada');
      }
      
      // Criar documento PDF
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Adicionar título
      doc.setFontSize(18);
      doc.text('Relatório de Apuração de Votos', 105, 15, { align: 'center' });
      
      // Adicionar informações da eleição
      doc.setFontSize(12);
      doc.text(`Eleição: ${eleicao.nome}`, 14, 25);
      doc.text(`Data: ${formatDate(eleicao.data)}`, 14, 32);
      doc.text(`Tipo: ${eleicao.tipo}`, 14, 39);
      doc.text(`Total de Eleitores: ${totalEleitoresTotais}`, 14, 46);
      doc.text(`Eleitores Votantes: ${totalEleitoresVotantes} (${((totalEleitoresVotantes / totalEleitoresTotais) * 100).toFixed(1)}%)`, 14, 53);
      doc.text(`Total de Votos Válidos: ${votosValidos}`, 14, 60);
      doc.text(`Total de Votos em Branco: ${votosBrancos}`, 14, 67);
      
      // Adicionar data de geração do relatório
      doc.setFontSize(10);
      doc.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 80);
      
      // Adicionar tabela de resultados
      const tableColumn = ["Número", "Candidato", "Votos", "Percentual"];
      
      // Obter total de votos
      const totalVotosComputados = votosValidos + votosBrancos;
      
      // Preparar dados da tabela
      const tableRows = candidatos.map(candidato => {
        const percentual = totalVotosComputados > 0 
          ? ((candidato.votos / totalVotosComputados) * 100).toFixed(1) 
          : 0;
        
        return [
          candidato.numero.toString(),
          candidato.nome,
          candidato.votos.toString(),
          `${percentual}%`
        ];
      });
      
      // Adicionar votos em branco
      if (votosBrancos > 0) {
        const percentual = totalVotosComputados > 0 
          ? ((votosBrancos / totalVotosComputados) * 100).toFixed(1) 
          : 0;
        
        tableRows.push([
          "-",
          "Votos em Branco",
          votosBrancos.toString(),
          `${percentual}%`
        ]);
      }
      
      // Adicionar tabela ao PDF
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 90,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 80 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' }
        },
        didDrawPage: function(data) {
          // Adicionar número de página no rodapé
          doc.setFontSize(10);
          doc.text(`Página ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });
      
      // Salvar o PDF
      doc.save(`Resultados_${eleicao.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      
      hideLoader();
      showNotification('PDF gerado com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao gerar PDF:', error);
      showNotification('Erro ao gerar PDF: ' + error.message, 'error');
    }
  }
  
  function exportExcel() {
    if (!eleicaoAtual) {
      showNotification('Selecione uma eleição para exportar', 'error');
      return;
    }
    
    try {
      showLoader('Gerando Excel...');
      
      // Obter informações da eleição
      const eleicao = eleicoes.find(e => e.id === eleicaoAtual);
      if (!eleicao) {
        throw new Error('Eleição não encontrada');
      }
      
      // Obter total de votos
      const totalVotosComputados = votosValidos + votosBrancos;
      
      // Preparar dados para o Excel
      const data = [
        ['Relatório de Apuração de Votos'],
        [],
        ['Eleição:', eleicao.nome],
        ['Data:', formatDate(eleicao.data)],
        ['Tipo:', eleicao.tipo],
        ['Total de Eleitores:', totalEleitoresTotais],
        ['Eleitores Votantes:', `${totalEleitoresVotantes} (${((totalEleitoresVotantes / totalEleitoresTotais) * 100).toFixed(1)}%)`],
        ['Total de Votos Válidos:', votosValidos],
        ['Total de Votos em Branco:', votosBrancos],
        [],
        ['Número', 'Candidato', 'Votos', 'Percentual']
      ];
      
      // Adicionar candidatos
      candidatos.forEach(candidato => {
        const percentual = totalVotosComputados > 0 
          ? ((candidato.votos / totalVotosComputados) * 100).toFixed(1) 
          : 0;
        
        data.push([
          candidato.numero,
          candidato.nome,
          candidato.votos,
          `${percentual}%`
        ]);
      });
      
      // Adicionar votos em branco
      if (votosBrancos > 0) {
        const percentual = totalVotosComputados > 0 
          ? ((votosBrancos / totalVotosComputados) * 100).toFixed(1) 
          : 0;
        
        data.push([
          "-",
          "Votos em Branco",
          votosBrancos,
          `${percentual}%`
        ]);
      }
      
      // Criar workbook
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      
      // Ajustar largura das colunas
      const wscols = [
        { wch: 10 }, // A
        { wch: 40 }, // B
        { wch: 10 }, // C
        { wch: 15 }  // D
      ];
      ws['!cols'] = wscols;
      
      // Salvar o arquivo
      XLSX.writeFile(wb, `Resultados_${eleicao.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      
      hideLoader();
      showNotification('Excel gerado com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao gerar Excel:', error);
      showNotification('Erro ao gerar Excel: ' + error.message, 'error');
    }
  }
  
  // ===== Utilitários =====
  
  function formatDate(dateString) {
    if (!dateString) return 'Data não definida';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
  
  function showLoader(message = 'Carregando...') {
    // Criar loader se não existir
    let loader = document.getElementById('app-loader');
    
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'app-loader';
      loader.className = 'loader-overlay';
      loader.innerHTML = `
        <div class="loader-content">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p class="mt-2 loader-message">${message}</p>
        </div>
      `;
      
      document.body.appendChild(loader);
    } else {
      loader.querySelector('.loader-message').textContent = message;
      loader.style.display = 'flex';
    }
  }
  
  function hideLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }
  
  function showNotification(message, type = 'info') {
    // Criar container de notificações se não existir
    let notifContainer = document.getElementById('notification-container');
    
    if (!notifContainer) {
      notifContainer = document.createElement('div');
      notifContainer.id = 'notification-container';
      notifContainer.className = 'position-fixed top-0 end-0 p-3';
      notifContainer.style.zIndex = '1050';
      
      document.body.appendChild(notifContainer);
    }
    
    // Criar a notificação
    const notification = document.createElement('div');
    notification.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'primary'}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');
    notification.setAttribute('aria-atomic', 'true');
    
    notification.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
    `;
    
    notifContainer.appendChild(notification);
    
    // Mostrar a notificação
    const toast = new bootstrap.Toast(notification, { autohide: true, delay: 5000 });
    toast.show();
    
    // Remover após fechar
    notification.addEventListener('hidden.bs.toast', () => {
      notification.remove();
    });
  }
});
