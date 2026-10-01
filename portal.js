/**
 * LÓGICA DEL PORTAL DEL HOSPITAL — MATRIZ (Superficie 2)
 */

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const COLOR_PRIMARIO = "#0A2540";
const COLOR_ACENTO = "#E07A5F";
const COLOR_VERDE = "#2A9D8F";
const COLOR_AMARILLO = "#FFB703";
const COLOR_ROJO = "#D90429";
const COLOR_AZUL = "#0077B6";

const seccionesCargadas = { inicio: false, tablero: false, verificacion: false, sello: false, preauditoria: false, "mis-datos": false };

// Se guardan los últimos datos recibidos para poder exportarlos a CSV/PNG sin volver a pedirlos
let ultimoTablero = null;
let vistaRelojActual = "parto";
let graficos = {}; // referencias a instancias de Chart.js por id de canvas

document.addEventListener("DOMContentLoaded", () => {
  configurarNavegacion();
  configurarTabsVerificacion();
  configurarDropzoneSinac();
  document.getElementById("tablero-periodo").addEventListener("change", () => cargarTablero());
  cargarSeccion("inicio");
});

/* ==========================================================================
   NAVEGACIÓN LATERAL (SPA simple, sin recarga de página)
   ========================================================================== */

function configurarNavegacion() {
  document.querySelectorAll(".portal-nav-item[data-seccion]").forEach(boton => {
    boton.addEventListener("click", () => {
      const seccion = boton.dataset.seccion;

      document.querySelectorAll(".portal-nav-item").forEach(b => b.classList.remove("activo"));
      boton.classList.add("activo");

      document.querySelectorAll(".portal-seccion").forEach(s => s.classList.remove("activa"));
      document.getElementById(`seccion-${seccion}`).classList.add("activa");

      cargarSeccion(seccion);
    });
  });
}

function cargarSeccion(seccion) {
  if (seccionesCargadas[seccion]) return; // ya se cargó una vez, evita pedir datos de más
  seccionesCargadas[seccion] = true;

  switch (seccion) {
    case "inicio": cargarInicio(); break;
    case "tablero": cargarTablero(); break;
    case "verificacion": cargarVerificacion(); break;
    case "sello": cargarSello(); break;
    case "preauditoria": cargarPreauditoria(); break;
    case "mis-datos": cargarMisDatos(); break;
  }
}

/* ==========================================================================
   UTILIDADES COMPARTIDAS
   ========================================================================== */

function mostrarToast(mensaje, esError = false) {
  const toast = document.getElementById("portal-toast");
  toast.textContent = mensaje;
  toast.classList.toggle("error", esError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 4000);
}

async function obtenerJSON(ruta) {
  const respuesta = await fetch(`${API_BASE_URL}${ruta}`);
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    throw new Error(cuerpo.detail || `Error al consultar ${ruta}`);
  }
  return respuesta.json();
}

async function enviarJSON(ruta, metodo, cuerpo) {
  const respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo)
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}));
    throw new Error(detalle.detail || `Error al enviar a ${ruta}`);
  }
  return respuesta.json();
}

function descargarCSV(nombreArchivo, filas) {
  const csv = filas.map(fila => fila.map(celda => `"${String(celda).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

function exportarPNG(idCanvas, nombreArchivo) {
  const grafico = graficos[idCanvas];
  if (!grafico) return;
  const enlace = document.createElement("a");
  enlace.href = grafico.toBase64Image();
  enlace.download = `${nombreArchivo}.png`;
  enlace.click();
}

function formatearFecha(iso) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/* ==========================================================================
   1. INICIO (RESUMEN)
   ========================================================================== */

async function cargarInicio() {
  try {
    const datos = await obtenerJSON("/portal/resumen");

    document.getElementById("sidebar-nombre-hospital").textContent = datos.hospital;
    document.getElementById("inicio-saludo").textContent = `Hola, ${datos.hospital}`;

    const tarjetas = document.getElementById("inicio-tarjetas");
    tarjetas.innerHTML = `
      <button class="portal-tarjeta-estado" onclick="irASeccion('sello')">
        <div class="etiqueta">Nivel del sello</div>
        <div class="valor">${datos.sello.nivelNombre}</div>
        <div class="etiqueta">Vigente ${datos.sello.dias_restantes} días más</div>
      </button>
      <button class="portal-tarjeta-estado" onclick="irASeccion('mis-datos')">
        <div class="etiqueta">Próximo hito</div>
        <div class="valor">${datos.proximo_hito.tipo}</div>
        <div class="etiqueta">${formatearFecha(datos.proximo_hito.fecha)}</div>
      </button>
      <button class="portal-tarjeta-estado alerta" onclick="irASeccion('tablero')">
        <div class="etiqueta">Alertas activas</div>
        <div class="valor">${datos.alertas.length}</div>
        <div class="etiqueta">fuera de rango o por vencer</div>
      </button>
      <button class="portal-tarjeta-estado" onclick="irASeccion('inicio')">
        <div class="etiqueta">Novedades</div>
        <div class="valor">${datos.novedades.length}</div>
        <div class="etiqueta">desde tu última visita</div>
      </button>
    `;

    document.getElementById("inicio-novedades").innerHTML = datos.novedades
      .map(n => `<li><span class="fecha">${formatearFecha(n.fecha)}</span>${n.mensaje}</li>`)
      .join("") || "<li>Sin novedades por ahora.</li>";

    document.getElementById("inicio-alertas").innerHTML = datos.alertas
      .map(a => `<li><button class="portal-nav-item" style="color:var(--color-marca-primario); padding:0; min-height:auto; text-align:left;" onclick="irASeccion('${a.seccion}')">${a.mensaje} →</button></li>`)
      .join("") || "<li>Sin alertas activas.</li>";

  } catch (error) {
    mostrarToast(error.message, true);
  }
}

function irASeccion(seccion) {
  document.querySelector(`.portal-nav-item[data-seccion="${seccion}"]`)?.click();
}

/* ==========================================================================
   2. MI TABLERO (MATRIZX)
   ========================================================================== */

async function cargarTablero() {
  const periodo = document.getElementById("tablero-periodo").value;
  try {
    const datos = await obtenerJSON(`/portal/tablero?periodo=${periodo}`);
    ultimoTablero = datos;

    // Cada widget se renderiza en su propio try/catch: si Chart.js u otro
    // recurso falla en uno, los demás widgets igual se muestran en vez de
    // dejar todo el tablero en blanco.
    const widgets = [
      () => renderRobson(datos.robson),
      () => renderTendencia(datos.tendencia_mensual),
      () => renderNeonatal(datos.indicadores_neonatales),
      () => renderReloj(datos.reloj_nacimiento),
      () => renderComparativas(datos.comparativas),
      () => renderCalidadCaptura(datos.calidad_captura_sinac),
    ];
    let huboErrorWidget = false;
    widgets.forEach(render => {
      try {
        render();
      } catch (errorWidget) {
        huboErrorWidget = true;
        console.error("Error al renderizar un widget del tablero:", errorWidget);
      }
    });
    if (huboErrorWidget) {
      mostrarToast("Algunos widgets no se pudieron dibujar. Revisa la consola del navegador.", true);
    }
  } catch (error) {
    mostrarToast(error.message, true);
  }
}

function crearOActualizarGrafico(idCanvas, config) {
  if (graficos[idCanvas]) graficos[idCanvas].destroy();
  const ctx = document.getElementById(idCanvas).getContext("2d");
  graficos[idCanvas] = new Chart(ctx, config);
}

function renderRobson(robson) {
  const etiquetas = robson.map(g => `G${g.grupo}`);
  crearOActualizarGrafico("grafico-robson", {
    data: {
      labels: etiquetas,
      datasets: [
        { type: "line", label: "Banda GPC (máx)", data: robson.map(g => g.banda_gpc[1]), borderColor: "rgba(42,157,143,0.35)", backgroundColor: "rgba(42,157,143,0.12)", pointRadius: 0, borderWidth: 1, fill: "+1", order: 3 },
        { type: "line", label: "Banda GPC (mín)", data: robson.map(g => g.banda_gpc[0]), borderColor: "rgba(42,157,143,0.35)", pointRadius: 0, borderWidth: 1, fill: false, order: 3 },
        { type: "bar", label: "Tasa de cesárea (%)", data: robson.map(g => g.tasa_cesarea), backgroundColor: COLOR_PRIMARIO, order: 1 },
        { type: "bar", label: "Contribución al total (%)", data: robson.map(g => g.contribucion_total), backgroundColor: COLOR_ACENTO, order: 2 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, title: { display: true, text: "%" } } },
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: (item) => {
              const g = robson[item.dataIndex];
              return g.denominador < 30 ? `n = ${g.denominador} (interpretar con cautela)` : `n = ${g.denominador}`;
            },
            title: (items) => robson[items[0].dataIndex].descripcion
          }
        }
      }
    }
  });
}

function renderTendencia(tendencia) {
  crearOActualizarGrafico("grafico-tendencia", {
    type: "line",
    data: {
      labels: tendencia.meses,
      datasets: [
        { label: "Parto", data: tendencia.parto, borderColor: COLOR_VERDE, backgroundColor: "rgba(42,157,143,0.35)", fill: true, tension: 0.25 },
        { label: "Cesárea", data: tendencia.cesarea, borderColor: COLOR_ROJO, backgroundColor: "rgba(217,4,41,0.25)", fill: true, tension: 0.25 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { stacked: true, beginAtZero: true, title: { display: true, text: "Nacimientos" } }, x: { stacked: true } }
    }
  });
}

function renderNeonatal(indicadores) {
  crearOActualizarGrafico("grafico-neonatal", {
    type: "line",
    data: {
      labels: indicadores.meses,
      datasets: [
        { label: "Apgar <7 (%)", data: indicadores.apgar_bajo.valores, borderColor: COLOR_ROJO, tension: 0.25 },
        { label: "Ref. Apgar <7", data: indicadores.meses.map(() => indicadores.apgar_bajo.referencia_gpc), borderColor: COLOR_ROJO, borderDash: [5, 5], pointRadius: 0 },
        { label: "Prematurez (%)", data: indicadores.prematurez.valores, borderColor: COLOR_AZUL, tension: 0.25 },
        { label: "Ref. prematurez", data: indicadores.meses.map(() => indicadores.prematurez.referencia_gpc), borderColor: COLOR_AZUL, borderDash: [5, 5], pointRadius: 0 },
        { label: "Programados 37–38 SDG (%)", data: indicadores.programados_37_38.valores, borderColor: COLOR_AMARILLO, tension: 0.25 },
        { label: "Ref. programados", data: indicadores.meses.map(() => indicadores.programados_37_38.referencia_gpc), borderColor: COLOR_AMARILLO, borderDash: [5, 5], pointRadius: 0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, title: { display: true, text: "%" } } },
      plugins: { tooltip: { callbacks: { afterLabel: () => `n promedio mensual ≈ ${indicadores.apgar_bajo.denominador_promedio}` } } }
    }
  });
}

function colorCeldaCalor(valor, maximo) {
  if (maximo === 0) return "#F1F3F5";
  const intensidad = valor / maximo;
  // Interpola entre gris muy claro y el color primario
  const r = Math.round(241 - intensidad * (241 - 10));
  const g = Math.round(243 - intensidad * (243 - 37));
  const b = Math.round(245 - intensidad * (245 - 64));
  return `rgb(${r},${g},${b})`;
}

function renderReloj(reloj) {
  const contenedor = document.getElementById("portal-heatmap");
  const matriz = vistaRelojActual === "parto" ? reloj.parto : reloj.cesarea;
  const maximo = Math.max(...matriz.flat());

  let html = `<div></div>`;
  for (let h = 0; h < 24; h++) {
    html += `<div class="portal-heatmap-etiqueta-hora">${h}</div>`;
  }
  reloj.dias.forEach((dia, indiceDia) => {
    html += `<div class="portal-heatmap-etiqueta-fila">${dia}</div>`;
    matriz[indiceDia].forEach((valor, hora) => {
      const cautela = valor < 30 ? " · interpretar con cautela" : "";
      html += `<div class="portal-heatmap-celda" style="background:${colorCeldaCalor(valor, maximo)}" title="${dia} ${hora}:00 — n=${valor}${cautela}"></div>`;
    });
  });
  contenedor.innerHTML = html;
}

function cambiarVistaReloj(vista) {
  vistaRelojActual = vista;
  document.getElementById("btn-reloj-parto").classList.toggle("activo", vista === "parto");
  document.getElementById("btn-reloj-cesarea").classList.toggle("activo", vista === "cesarea");
  if (ultimoTablero) renderReloj(ultimoTablero.reloj_nacimiento);
}

function renderComparativas(comparativas) {
  const contenedor = document.getElementById("tablero-comparativas");
  const maximoBarra = Math.max(comparativas.mi_hospital_cesarea_global, comparativas.promedio_estatal_privado_sinac, 100) ;
  let html = `
    <div class="portal-comparativas-fila">
      <span>Mi hospital</span>
      <div class="portal-comparativas-barra-fondo"><div class="portal-comparativas-barra" style="width:${(comparativas.mi_hospital_cesarea_global / maximoBarra) * 100}%; background:${COLOR_PRIMARIO}"></div></div>
      <span title="n=${comparativas.mi_hospital_n}">${comparativas.mi_hospital_cesarea_global}%</span>
    </div>
    <div class="portal-comparativas-fila">
      <span>Promedio estatal privado (SINAC)</span>
      <div class="portal-comparativas-barra-fondo"><div class="portal-comparativas-barra" style="width:${(comparativas.promedio_estatal_privado_sinac / maximoBarra) * 100}%; background:${COLOR_AZUL}"></div></div>
      <span>${comparativas.promedio_estatal_privado_sinac}%</span>
    </div>
  `;
  if (comparativas.cartera_visible) {
    html += `
      <div class="portal-comparativas-fila">
        <span>Percentil cartera MatriZ</span>
        <div class="portal-comparativas-barra-fondo"><div class="portal-comparativas-barra" style="width:${comparativas.percentil_cartera_matriz}%; background:${COLOR_ACENTO}"></div></div>
        <span>Percentil ${comparativas.percentil_cartera_matriz}</span>
      </div>`;
  } else {
    html += `<p class="portal-cartera-oculta">El percentil de cartera se activa cuando MatriZ certifica al menos 5 hospitales (hoy: ${comparativas.n_hospitales_cartera}), para mantener la comparación anónima.</p>`;
  }
  contenedor.innerHTML = html;
}

function renderCalidadCaptura(calidad) {
  document.getElementById("tablero-calidad-captura").innerHTML = `
    <p style="font-size:28px; font-weight:bold; color:${COLOR_VERDE}; margin-bottom:4px;">${calidad.pct_registros_limpios}%</p>
    <p style="color:var(--portal-texto-secundario); margin-bottom:16px;">registros limpios de ${calidad.total_registros} capturados</p>
    <h4 style="font-size:13px; margin-bottom:8px;">Errores más frecuentes</h4>
    <ul class="portal-errores-lista">
      ${calidad.top_errores.map(e => `<li><span>${e.campo}</span><span>${e.pct}% (n=${e.n})</span></li>`).join("")}
    </ul>
  `;
}

function exportarCSVRobson() {
  if (!ultimoTablero) return;
  const filas = [["Grupo", "Descripción", "Tasa de cesárea (%)", "Contribución al total (%)", "n"]];
  ultimoTablero.robson.forEach(g => filas.push([g.grupo, g.descripcion, g.tasa_cesarea, g.contribucion_total, g.denominador]));
  descargarCSV("robson.csv", filas);
}

function exportarCSVTendencia() {
  if (!ultimoTablero) return;
  const t = ultimoTablero.tendencia_mensual;
  const filas = [["Mes", "Parto", "Cesárea"]];
  t.meses.forEach((mes, i) => filas.push([mes, t.parto[i], t.cesarea[i]]));
  descargarCSV("tendencia_mensual.csv", filas);
}

function exportarCSVNeonatal() {
  if (!ultimoTablero) return;
  const ind = ultimoTablero.indicadores_neonatales;
  const filas = [["Mes", "Apgar<7 (%)", "Prematurez (%)", "Programados 37-38 (%)"]];
  ind.meses.forEach((mes, i) => filas.push([mes, ind.apgar_bajo.valores[i], ind.prematurez.valores[i], ind.programados_37_38.valores[i]]));
  descargarCSV("indicadores_neonatales.csv", filas);
}

function exportarCSVReloj() {
  if (!ultimoTablero) return;
  const reloj = ultimoTablero.reloj_nacimiento;
  const filas = [["Vía", "Día", ...Array.from({ length: 24 }, (_, h) => `${h}:00`)]];
  reloj.dias.forEach((dia, i) => filas.push(["Parto", dia, ...reloj.parto[i]]));
  reloj.dias.forEach((dia, i) => filas.push(["Cesárea", dia, ...reloj.cesarea[i]]));
  descargarCSV("reloj_nacimiento.csv", filas);
}

/* ==========================================================================
   3. MI VERIFICACIÓN
   ========================================================================== */

let verificacionDatosCache = null;

function configurarTabsVerificacion() {
  document.querySelectorAll(".portal-tab-btn").forEach(boton => {
    boton.addEventListener("click", () => {
      document.querySelectorAll(".portal-tab-btn").forEach(b => b.classList.remove("activo"));
      document.querySelectorAll(".portal-tab-panel").forEach(p => p.classList.remove("activo"));
      boton.classList.add("activo");
      document.getElementById(`tab-${boton.dataset.tab}`).classList.add("activo");
    });
  });
}

async function cargarVerificacion() {
  try {
    const datos = await obtenerJSON("/portal/verificacion");
    verificacionDatosCache = datos;

    document.getElementById("verificacion-lineas-rojas").innerHTML = datos.lineas_rojas.map(lr => `
      <div class="portal-linea-roja-item ${lr.cumple ? "cumple" : "no-cumple"}">
        <span class="semaforo-punto ${lr.cumple ? "semaforo-verde" : "semaforo-rojo"}"></span>
        ${lr.texto}
      </div>
    `).join("");

    document.getElementById("verificacion-dominios").innerHTML = datos.dominios.map(d => `
      <div class="portal-dominio-barra-fila">
        <div class="portal-dominio-barra-header" onclick="toggleDominio('${d.id}')">
          <span class="nombre"><span class="semaforo-punto semaforo-${d.semaforo}"></span>${d.nombre}</span>
          <span>${d.puntaje} / 100 (umbral ${d.umbral})</span>
        </div>
        <div class="portal-dominio-barra-fondo">
          <div class="portal-dominio-barra" style="width:${d.puntaje}%; background:${d.semaforo === "verde" ? COLOR_VERDE : d.semaforo === "amarillo" ? COLOR_AMARILLO : COLOR_ROJO}"></div>
        </div>
        <div class="portal-dominio-detalle" id="detalle-${d.id}">
          ${(datos.detalle_dominios[d.id] || []).map(c => `
            <div class="criterio-item">
              <strong>${c.criterio}</strong> — escalón ${c.escalon_alcanzado}/4
              <p>${c.hallazgo}</p>
            </div>
          `).join("") || "<p>Sin detalle disponible para este dominio.</p>"}
        </div>
      </div>
    `).join("");

    renderAreasMejora(datos.areas_mejora);

    document.getElementById("verificacion-historial-cuerpo").innerHTML = datos.historial.map(h => `
      <tr><td>${formatearFecha(h.fecha)}</td><td>${h.nivel_resultante}</td><td>${h.puntaje_global}</td></tr>
    `).join("");

  } catch (error) {
    mostrarToast(error.message, true);
  }
}

function toggleDominio(id) {
  document.getElementById(`detalle-${id}`).classList.toggle("abierto");
}

function renderAreasMejora(areas) {
  // Prioridad: alto impacto y bajo esfuerzo primero (matriz impacto × esfuerzo)
  const pesoImpacto = { alto: 3, medio: 2, bajo: 1 };
  const pesoEsfuerzoInverso = { bajo: 3, medio: 2, alto: 1 }; // menor esfuerzo = mayor prioridad
  const puntaje = (a) => pesoImpacto[a.impacto] * 10 + pesoEsfuerzoInverso[a.esfuerzo];
  const ordenadas = [...areas].sort((a, b) => puntaje(b) - puntaje(a));

  document.getElementById("verificacion-areas-mejora").innerHTML = ordenadas.map(a => `
    <div class="portal-area-mejora-card">
      <div class="portal-area-mejora-etiquetas">
        <span class="portal-etiqueta-impacto impacto-${a.impacto}">Impacto ${a.impacto}</span>
        <span class="portal-etiqueta-esfuerzo esfuerzo-${a.esfuerzo}">Esfuerzo ${a.esfuerzo}</span>
      </div>
      <h4 style="margin-bottom:6px;">${a.titulo}</h4>
      <div class="portal-area-mejora-meta">Criterio de origen: ${a.criterio_origen}<br>Ancla normativa: ${a.ancla_normativa}</div>
      <div class="portal-area-mejora-avance">
        <label style="font-size:13px; display:block; margin-bottom:4px;">Avance registrado por el hospital:</label>
        <textarea id="avance-${a.id}">${a.avance_registrado || ""}</textarea>
        <button class="portal-btn-mini" style="margin-top:8px;" onclick="guardarAvanceArea('${a.id}')">Guardar avance</button>
      </div>
    </div>
  `).join("");
}

async function guardarAvanceArea(id) {
  const texto = document.getElementById(`avance-${id}`).value;
  try {
    await enviarJSON(`/portal/areas-mejora/${id}`, "PATCH", { avance_registrado: texto });
    mostrarToast("Avance guardado.");
  } catch (error) {
    mostrarToast(error.message, true);
  }
}

/* ==========================================================================
   4. MI SELLO
   ========================================================================== */

async function cargarSello() {
  try {
    const datos = await obtenerJSON("/portal/sello");

    document.getElementById("sello-insignia-svg").data = `${API_BASE_URL}/portal/sello/kit/logo.svg`;
    document.getElementById("sello-nivel-nombre").textContent = datos.nivelNombre;
    document.getElementById("sello-vigencia-texto").textContent = `Vigente hasta ${datos.vigencia}`;
    document.getElementById("sello-ficha-publica").href = datos.ficha_publica_url;

    document.getElementById("sello-kit-lista").innerHTML = datos.kit.map(item => `
      <li>
        <span>${item.nombre}</span>
        <a class="btn btn-secundario portal-btn-mini" style="width:auto;" href="${API_BASE_URL}${item.url}" target="_blank" download>Descargar</a>
      </li>
    `).join("");

    const bannerSuspendido = document.getElementById("sello-estado-suspendido");
    if (datos.estado !== "vigente") {
      bannerSuspendido.innerHTML = `<div class="portal-estado-suspendido"><strong>Estado: ${datos.estado}.</strong> ${datos.detalle_estado || ""}</div>`;
    } else {
      bannerSuspendido.innerHTML = "";
    }
  } catch (error) {
    mostrarToast(error.message, true);
  }
}

/* ==========================================================================
   5. PRE-AUDITORÍA
   ========================================================================== */

let estandarPreauditoriaCache = [];

async function cargarPreauditoria() {
  try {
    const datos = await obtenerJSON("/portal/preauditoria");
    estandarPreauditoriaCache = datos.estandar;

    const form = document.getElementById("form-preauditoria");
    form.innerHTML = datos.estandar.map(bloque => `
      <div class="portal-preauditoria-bloque">
        <h3 style="color:var(--color-marca-primario); margin-bottom:12px;">${bloque.dominio_nombre}</h3>
        ${bloque.criterios.map(c => `
          <div class="portal-preauditoria-criterio">
            <strong>${c.texto}</strong>
            <div class="portal-preauditoria-escalones">
              ${c.escalones.map((texto, i) => `
                <label class="portal-escalon-opcion">
                  <input type="radio" name="${c.id}" value="${i + 1}"> Escalón ${i + 1}
                  <div>${texto}</div>
                </label>
              `).join("")}
            </div>
            <div class="portal-preauditoria-evidencia">
              <label style="font-size:13px;">Evidencia (opcional): <input type="file" name="evidencia-${c.id}"></label>
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");

  } catch (error) {
    mostrarToast(error.message, true);
  }
}

async function enviarAutoevaluacion() {
  const respuestas = [];
  estandarPreauditoriaCache.forEach(bloque => {
    bloque.criterios.forEach(c => {
      const seleccionado = document.querySelector(`input[name="${c.id}"]:checked`);
      if (seleccionado) {
        const archivoInput = document.querySelector(`input[name="evidencia-${c.id}"]`);
        respuestas.push({
          criterio_id: c.id,
          escalon_estimado: parseInt(seleccionado.value, 10),
          evidencia_nombre: archivoInput.files[0] ? archivoInput.files[0].name : null
        });
      }
    });
  });

  if (respuestas.length === 0) {
    mostrarToast("Marca al menos un escalón antes de continuar.", true);
    return;
  }

  try {
    const resultado = await enviarJSON("/portal/preauditoria/autoevaluacion", "POST", { respuestas });
    const contenedor = document.getElementById("preauditoria-resultado");
    contenedor.style.display = "block";
    contenedor.innerHTML = `
      <h3 style="color:var(--color-marca-primario); margin-bottom:10px;">Brecha estimada por dominio</h3>
      ${resultado.brecha_por_dominio.map(b => `
        <div class="portal-brecha-fila"><span>${b.dominio}</span><span>${b.brecha_pct}% de brecha (escalón promedio ${b.escalon_promedio}/4)</span></div>
      `).join("")}
      <p style="margin-top:12px; font-style:italic; color:var(--portal-texto-secundario);">${resultado.etiqueta}</p>
    `;
  } catch (error) {
    mostrarToast(error.message, true);
  }
}

/* ==========================================================================
   6. MIS DATOS
   ========================================================================== */

function configurarDropzoneSinac() {
  const zona = document.getElementById("sinac-dropzone");
  const input = document.getElementById("sinac-input");

  zona.addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files[0]) subirArchivoSinac(input.files[0]); });

  ["dragover", "dragenter"].forEach(evento =>
    zona.addEventListener(evento, (e) => { e.preventDefault(); zona.classList.add("arrastrando"); })
  );
  ["dragleave", "drop"].forEach(evento =>
    zona.addEventListener(evento, (e) => { e.preventDefault(); zona.classList.remove("arrastrando"); })
  );
  zona.addEventListener("drop", (e) => {
    const archivo = e.dataTransfer.files[0];
    if (archivo) subirArchivoSinac(archivo);
  });
}

async function subirArchivoSinac(archivo) {
  const formData = new FormData();
  formData.append("archivo", archivo);

  document.getElementById("sinac-reporte").innerHTML = "<p>Validando archivo…</p>";

  try {
    const respuesta = await fetch(`${API_BASE_URL}/portal/sinac/cargar`, { method: "POST", body: formData });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.detail || "No se pudo validar el archivo");

    const reporte = datos.reporte_calidad;
    document.getElementById("sinac-reporte").innerHTML = `
      <div class="portal-card">
        <p style="font-size:24px; font-weight:bold; color:${reporte.pct_limpios >= 90 ? COLOR_VERDE : COLOR_AMARILLO};">${reporte.pct_limpios}% limpio</p>
        <p style="color:var(--portal-texto-secundario); margin-bottom:12px;">${reporte.registros_limpios} de ${reporte.total_registros} registros sin errores</p>
        ${reporte.top_errores.length ? `
          <h4 style="font-size:13px; margin-bottom:6px;">Errores encontrados</h4>
          <ul class="portal-errores-lista">${reporte.top_errores.map(e => `<li><span>${e.campo}</span><span>${e.n} filas (${e.pct}%)</span></li>`).join("")}</ul>
        ` : "<p>Sin errores detectados. 🎉</p>"}
      </div>
    `;
    mostrarToast("Archivo cargado y validado correctamente.");
    cargarHistorialSinac();
  } catch (error) {
    document.getElementById("sinac-reporte").innerHTML = "";
    mostrarToast(error.message, true);
  }
}

async function cargarHistorialSinac() {
  try {
    const historial = await obtenerJSON("/portal/sinac/historial");
    document.getElementById("sinac-historial-cuerpo").innerHTML = historial.slice().reverse().map(h => `
      <tr><td>${formatearFecha(h.fecha)}</td><td>${h.archivo}</td><td>${h.total_registros}</td><td>${h.pct_limpios}%</td></tr>
    `).join("");
  } catch (error) {
    mostrarToast(error.message, true);
  }
}

let definicionCuestionarioCache = [];

async function cargarMisDatos() {
  await cargarHistorialSinac();

  try {
    const datos = await obtenerJSON("/portal/cuestionario-estructural");
    definicionCuestionarioCache = datos.definicion;
    renderCuestionario(datos.definicion, datos.respuestas);
    actualizarProgresoCuestionario(datos.pct_completado);
  } catch (error) {
    mostrarToast(error.message, true);
  }
}

function renderCuestionario(definicion, respuestas) {
  const form = document.getElementById("form-cuestionario");
  form.innerHTML = definicion.map(bloque => `
    <fieldset>
      <legend>${bloque.categoria}</legend>
      ${bloque.campos.map(campo => `
        <div class="campo-fila">
          <label for="campo-${campo.id}">${campo.etiqueta}</label>
          ${renderInputCuestionario(campo, respuestas[campo.id])}
        </div>
      `).join("")}
    </fieldset>
  `).join("");
}

function renderInputCuestionario(campo, valorActual) {
  const valor = valorActual || "";
  if (campo.tipo === "booleano") {
    return `
      <select id="campo-${campo.id}" class="control-tactil">
        <option value="" ${valor === "" ? "selected" : ""}>Sin responder</option>
        <option value="true" ${valor === "true" ? "selected" : ""}>Sí</option>
        <option value="false" ${valor === "false" ? "selected" : ""}>No</option>
      </select>`;
  }
  if (campo.tipo === "numero") {
    return `<input type="number" id="campo-${campo.id}" class="control-tactil" value="${valor}">`;
  }
  if (campo.tipo === "fecha") {
    return `<input type="date" id="campo-${campo.id}" class="control-tactil" value="${valor}">`;
  }
  return `<input type="text" id="campo-${campo.id}" class="control-tactil" value="${valor}">`;
}

function actualizarProgresoCuestionario(pct) {
  document.getElementById("cuestionario-progreso-barra").style.width = `${pct}%`;
  document.getElementById("cuestionario-progreso-texto").textContent = `${pct}% completado`;
}

async function guardarCuestionarioParcial() {
  const respuestas = {};
  definicionCuestionarioCache.forEach(bloque => {
    bloque.campos.forEach(campo => {
      const elemento = document.getElementById(`campo-${campo.id}`);
      if (elemento) respuestas[campo.id] = elemento.value;
    });
  });

  try {
    const resultado = await enviarJSON("/portal/cuestionario-estructural", "POST", respuestas);
    actualizarProgresoCuestionario(resultado.pct_completado);
    mostrarToast("Avance del cuestionario guardado.");
  } catch (error) {
    mostrarToast(error.message, true);
  }
}
