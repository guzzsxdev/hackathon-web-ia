// MedLembra – lembrete de medicamentos assistivo
// Manipulação do DOM + localStorage + Web Speech API (leitura em voz alta)

const CHAVE = "medlembra:v1";
const CHAVE_CFG = "medlembra:cfg";

const el = {
  form: document.getElementById("formMed"),
  nome: document.getElementById("nome"),
  dose: document.getElementById("dose"),
  horario: document.getElementById("horario"),
  lista: document.getElementById("lista"),
  vazio: document.getElementById("vazio"),
  hora: document.getElementById("hora"),
  proxima: document.getElementById("proxima"),
  progresso: document.getElementById("progresso"),
  alerta: document.getElementById("alerta"),
  alertaTexto: document.getElementById("alertaTexto"),
  btnTomei: document.getElementById("alertaTomei"),
  btnDepois: document.getElementById("alertaDepois"),
  btnMais: document.getElementById("btnMais"),
  btnMenos: document.getElementById("btnMenos"),
  btnContraste: document.getElementById("btnContraste"),
  btnVoz: document.getElementById("btnVoz"),
  btnLimpar: document.getElementById("btnLimpar"),
};

let meds = carregar(CHAVE, []);
let cfg = carregar(CHAVE_CFG, { fonte: 18, contraste: false, voz: true });
let alertaAtual = null;
let adiados = {}; // id -> timestamp até quando está adiado
let ultimoMinutoAvisado = {};

function carregar(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch (e) {
    return padrao;
  }
}
function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(meds));
    localStorage.setItem(CHAVE_CFG, JSON.stringify(cfg));
  } catch (e) { /* armazenamento indisponível */ }
}

function falar(texto) {
  if (!cfg.voz || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "pt-BR";
  window.speechSynthesis.speak(u);
}

function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* sem áudio */ }
}

function minutosDe(horario) {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}

function agoraEmMinutos() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function aplicarConfig() {
  document.documentElement.style.setProperty("--fonte", cfg.fonte + "px");
  document.body.classList.toggle("contraste", cfg.contraste);
  el.btnContraste.setAttribute("aria-pressed", String(cfg.contraste));
  el.btnContraste.textContent = cfg.contraste ? "Contraste normal" : "Alto contraste";
  el.btnVoz.setAttribute("aria-pressed", String(cfg.voz));
  el.btnVoz.textContent = cfg.voz ? "🔊 Voz: ligada" : "🔇 Voz: desligada";
}

function render() {
  const ordenados = [...meds].sort((a, b) => a.horario.localeCompare(b.horario));
  el.lista.innerHTML = "";
  const agora = agoraEmMinutos();

  ordenados.forEach((m) => {
    const li = document.createElement("li");
    const atrasado = !m.tomado && minutosDe(m.horario) < agora;
    li.className = "item" + (m.tomado ? " tomado" : "") + (atrasado ? " atrasado" : "");

    const h = document.createElement("div");
    h.className = "horario";
    h.textContent = m.horario;

    const info = document.createElement("div");
    const n = document.createElement("div");
    n.className = "nome";
    n.textContent = m.nome;
    const d = document.createElement("div");
    d.className = "dose";
    d.textContent = m.dose + (m.tomado ? " · ✔ tomado" : atrasado ? " · ⚠ atrasado" : "");
    info.append(n, d);

    const acoes = document.createElement("div");
    acoes.className = "acoes";
    const tomar = document.createElement("button");
    tomar.type = "button";
    tomar.className = m.tomado ? "" : "tomar";
    tomar.textContent = m.tomado ? "Desfazer" : "✔ Tomei";
    tomar.addEventListener("click", () => alternar(m.id));
    const ex = document.createElement("button");
    ex.type = "button";
    ex.className = "excluir";
    ex.setAttribute("aria-label", "Excluir " + m.nome);
    ex.textContent = "🗑";
    ex.addEventListener("click", () => excluir(m.id));
    acoes.append(tomar, ex);

    li.append(h, info, acoes);
    el.lista.appendChild(li);
  });

  el.vazio.hidden = meds.length > 0;
  el.btnLimpar.hidden = meds.length === 0;
  const tomados = meds.filter((m) => m.tomado).length;
  el.progresso.textContent = tomados + " de " + meds.length + " tomados";
  atualizarProxima();
}

function atualizarProxima() {
  const agora = agoraEmMinutos();
  const pendentes = meds
    .filter((m) => !m.tomado)
    .sort((a, b) => a.horario.localeCompare(b.horario));
  if (meds.length === 0) {
    el.proxima.textContent = "Nenhum medicamento cadastrado.";
  } else if (pendentes.length === 0) {
    el.proxima.textContent = "🎉 Tudo certo! Todos os medicamentos de hoje foram tomados.";
  } else {
    const prox = pendentes.find((m) => minutosDe(m.horario) >= agora) || pendentes[0];
    el.proxima.textContent = "Próximo: " + prox.nome + " às " + prox.horario + " (" + prox.dose + ")";
  }
}

function alternar(id) {
  const m = meds.find((x) => x.id === id);
  if (!m) return;
  m.tomado = !m.tomado;
  salvar();
  render();
}

function excluir(id) {
  meds = meds.filter((x) => x.id !== id);
  salvar();
  render();
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  meds.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nome: el.nome.value.trim(),
    dose: el.dose.value.trim(),
    horario: el.horario.value,
    tomado: false,
  });
  salvar();
  el.form.reset();
  el.nome.focus();
  render();
});

el.btnLimpar.addEventListener("click", () => {
  meds.forEach((m) => (m.tomado = false));
  adiados = {};
  ultimoMinutoAvisado = {};
  salvar();
  render();
});

function mostrarAlerta(m) {
  alertaAtual = m;
  el.alertaTexto.textContent = m.nome + " – " + m.dose;
  el.alerta.hidden = false;
  el.btnTomei.focus();
  bip();
  falar("Hora de tomar " + m.nome + ". " + m.dose);
}

function fecharAlerta() {
  el.alerta.hidden = true;
  alertaAtual = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

el.btnTomei.addEventListener("click", () => {
  if (alertaAtual) alternar(alertaAtual.id);
  fecharAlerta();
});
el.btnDepois.addEventListener("click", () => {
  if (alertaAtual) adiados[alertaAtual.id] = Date.now() + 5 * 60 * 1000;
  fecharAlerta();
});

function verificarHorarios() {
  if (alertaAtual) return;
  const d = new Date();
  const hhmm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  for (const m of meds) {
    if (m.tomado) continue;
    const adiado = adiados[m.id] && Date.now() < adiados[m.id];
    const chegou = m.horario === hhmm && ultimoMinutoAvisado[m.id] !== hhmm;
    const voltou = adiados[m.id] && Date.now() >= adiados[m.id];
    if (!adiado && (chegou || voltou)) {
      ultimoMinutoAvisado[m.id] = hhmm;
      delete adiados[m.id];
      mostrarAlerta(m);
      break;
    }
  }
}

function tique() {
  el.hora.textContent = new Date().toLocaleTimeString("pt-BR");
  verificarHorarios();
}

el.btnMais.addEventListener("click", () => { cfg.fonte = Math.min(28, cfg.fonte + 2); salvar(); aplicarConfig(); });
el.btnMenos.addEventListener("click", () => { cfg.fonte = Math.max(14, cfg.fonte - 2); salvar(); aplicarConfig(); });
el.btnContraste.addEventListener("click", () => { cfg.contraste = !cfg.contraste; salvar(); aplicarConfig(); });
el.btnVoz.addEventListener("click", () => {
  cfg.voz = !cfg.voz;
  salvar();
  aplicarConfig();
  if (cfg.voz) falar("Voz ligada");
});

aplicarConfig();
render();
tique();
setInterval(tique, 1000);
setInterval(render, 60000); // atualiza "atrasado" a cada minuto
