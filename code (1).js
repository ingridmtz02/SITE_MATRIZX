/**
 * LÓGICA FRONTEND MATRIZ — INTEGRADA CON BACKEND PYTHON
 */

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";
const FORM_STORAGE_KEY = "matriz_borrador_solicitud_v1";

document.addEventListener("DOMContentLoaded", () => {
  cargarCatalogo();
  restaurarBorradorSolicitud();
});

/* ==========================================================================
   1. CATÁLOGO PÚBLICO (TRANSPARENCIA ASIMÉTRICA) — DATOS LOCALES
   Vive en el propio frontend para que el catálogo funcione también en un
   hosting estático (GitHub Pages) sin necesidad de levantar app.py.
   Si agregas/editas hospitales en HOSPITALES_DB (app.py), refleja el mismo
   cambio aquí para que ambas fuentes no se desincronicen.
   ========================================================================== */

const HOSPITALES_LOCAL = [
  {
    id: "hosp-1",
    nombre: "Hospital de la Mujer Jalisco",
    ciudad: "Guadalajara",
    estado: "Jalisco",
    nivel: "nivel3",
    nivelNombre: "Nivel 3 — Referente",
    icono: "🏆",
    claseBadge: "badge-nivel3",
    vigencia: "Agosto 2027"
  },
  {
    id: "hosp-2",
    nombre: "Clínica Materna del Sol",
    ciudad: "Zapopan",
    estado: "Jalisco",
    nivel: "nivel2",
    nivelNombre: "Nivel 2 — Consolidado",
    icono: "⭐",
    claseBadge: "badge-nivel2",
    vigencia: "Diciembre 2026"
  },
  {
    id: "hosp-3",
    nombre: "Hospital San Rafael",
    ciudad: "Ciudad de México",
    estado: "CDMX",
    nivel: "nivel1",
    nivelNombre: "Nivel 1 — Comprometido",
    icono: "🛡️",
    claseBadge: "badge-nivel1",
    vigencia: "Octubre 2026"
  }
];

function cargarCatalogo() {
  const estadoSel = document.getElementById("filtro-estado").value;
  const nivelSel = document.getElementById("filtro-nivel").value;

  let resultados = HOSPITALES_LOCAL;

  if (estadoSel && estadoSel !== "todos") {
    resultados = resultados.filter(h => h.estado.toLowerCase() === estadoSel.toLowerCase());
  }

  if (nivelSel && nivelSel !== "todos") {
    resultados = resultados.filter(h => h.nivel === nivelSel);
  }

  renderizarCatalogo(resultados);
}

function renderizarCatalogo(lista) {
  const contenedor = document.getElementById("contenedor-tarjetas-hospitales");
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio-card">
        <h3>Los primeros hospitales están en proceso de verificación</h3>
        <p>No se encontraron resultados para los filtros seleccionados. Invita a tu hospital a certificarse.</p>
      </div>
    `;
    return;
  }

  lista.forEach(hosp => {
    const tarjetaHtml = `
      <article class="tarjeta-hospital">
        <div>
          <h3>${hosp.nombre}</h3>
          <p class="ciudad-hospital">${hosp.ciudad}, ${hosp.estado}</p>
          <div class="insignia-sello ${hosp.claseBadge}">
            <span aria-hidden="true">${hosp.icono}</span>
            <span>${hosp.nivelNombre}</span>
          </div>
          <p class="vigencia-texto"><strong>Sello Vigente hasta:</strong> ${hosp.vigencia}</p>
        </div>
        <button type="button" class="btn btn-secundario btn-bloque-tactil" onclick="verFichaPublica('${hosp.nombre}', '${hosp.nivelNombre}', '${hosp.vigencia}')">Ver Ficha Pública</button>
      </article>
    `;
    contenedor.innerHTML += tarjetaHtml;
  });
}

function filtrarCatalogo() {
  cargarCatalogo();
}

function buscarDesdeHero(e) {
  e.preventDefault();
  const ub = document.getElementById("hero-ubicacion").value;
  if (ub) {
    document.getElementById("filtro-estado").value = ub;
  }
  filtrarCatalogo();
  document.getElementById("catalogo").scrollIntoView({ behavior: 'smooth' });
}

function verFichaPublica(nombre, nivel, vigencia) {
  alert(`FICHA PÚBLICA\n\nHospital: ${nombre}\nInsignia: ${nivel}\nVigencia: ${vigencia}\n\n(Regla de Transparencia Asimétrica: Los puntajes por dominio y los detalles de auditoría son privados del hospital).`);
}

/* ==========================================================================
   2. CONTROL STEPPER NUMÉRICO (TACTILIDAD >= 48PX)
   ========================================================================== */

function cambiarStepper(inputId, delta) {
  const input = document.getElementById(inputId);
  let valorActual = parseInt(input.value) || 0;
  let min = parseInt(input.min) || 0;
  
  let nuevoValor = valorActual + delta;
  if (nuevoValor >= min) {
    input.value = nuevoValor;
    guardarBorradorFormulario();
  }
}

/* ==========================================================================
   3. ENVÍO DE FORMULARIO CON PRESERVACIÓN Y FALLBACK DE RED
   ========================================================================== */

document.getElementById("form-solicitud-hospital").addEventListener("input", guardarBorradorFormulario);

function guardarBorradorFormulario() {
  const datos = {
    nombre: document.getElementById("sol-nombre").value,
    cargo: document.getElementById("sol-cargo").value,
    hospital: document.getElementById("sol-hospital").value,
    correo: document.getElementById("sol-correo").value,
    nacimientos: document.getElementById("sol-nacimientos").value
  };
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(datos));
}

function restaurarBorradorSolicitud() {
  const borrador = localStorage.getItem(FORM_STORAGE_KEY);
  if (borrador) {
    try {
      const datos = JSON.parse(borrador);
      document.getElementById("sol-nombre").value = datos.nombre || "";
      document.getElementById("sol-cargo").value = datos.cargo || "";
      document.getElementById("sol-hospital").value = datos.hospital || "";
      document.getElementById("sol-correo").value = datos.correo || "";
      document.getElementById("sol-nacimientos").value = datos.nacimientos || 200;
    } catch (e) {
      console.error("Error al restaurar borrador local", e);
    }
  }
}

async function guardarEnviarSolicitud(e) {
  e.preventDefault();

  const payload = {
    nombre_contacto: document.getElementById("sol-nombre").value,
    cargo: document.getElementById("sol-cargo").value,
    hospital: document.getElementById("sol-hospital").value,
    correo: document.getElementById("sol-correo").value,
    nacimientos_anuales: parseInt(document.getElementById("sol-nacimientos").value) || 200
  };

  try {
    const respuesta = await fetch(`${API_BASE_URL}/solicitud-registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!respuesta.ok) throw new Error("Falla al guardar en servidor");

    const resultado = await respuesta.json();
    ocultarBannerError();
    alert(`¡Solicitud enviada con éxito! Folio: ${resultado.id_registro}`);
    
    // Limpieza tras envío exitoso
    localStorage.removeItem(FORM_STORAGE_KEY);
    document.getElementById("form-solicitud-hospital").reset();
    document.getElementById("sol-nacimientos").value = 200;

  } catch (error) {
    console.error("Error de red/servidor:", error);
    // Si falla, NO se borra localStorage y se notifica al usuario
    mostrarBannerError();
  }
}

function mostrarBannerError() {
  document.getElementById("banner-error").classList.remove("hidden");
}

function ocultarBannerError() {
  document.getElementById("banner-error").classList.add("hidden");
}

/* ==========================================================================
   4. MODAL Y LOGIN UNIFICADO CON PYTHON
   ========================================================================== */

function abrirModalLogin() {
  document.getElementById("modal-login").classList.remove("hidden");
}

function cerrarModalLogin() {
  document.getElementById("modal-login").classList.add("hidden");
}

async function procesarLogin(e) {
  e.preventDefault();
  const payload = {
    correo: document.getElementById("login-correo").value,
    password: document.getElementById("login-pass").value
  };

  try {
    const respuesta = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!respuesta.ok) throw new Error("Credenciales inválidas");

    const data = await respuesta.json();

    if (data.rol === "hospital") {
      // El portal del hospital (Superficie 2) aún no distingue director vs.
      // calidad/epidemiología; ambos entran al mismo portal.html por ahora.
      window.location.href = "portal.html";
      return;
    }

    alert(`Bienvenido. Rol detectado por backend Python: ${data.rol.toUpperCase()}\n\nEl portal para este rol todavía no está construido.`);
    cerrarModalLogin();

  } catch (error) {
    alert("Error de autenticación. Verifica tu correo y contraseña.");
  }
}