// js/data_bridge.js
// Puente gradual: lee primero desde Supabase y, si falla o aun no esta listo,
// mantiene el flujo actual con Google Apps Script.

(function initVidafemDataBridge() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (window.vfDataBridge) return;

  function getSessionSafe_() {
    try {
      const raw = sessionStorage.getItem("vidafem_session");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getCurrentRole_() {
    const s = getSessionSafe_();
    return String((s && s.role) || "").trim().toLowerCase();
  }

  function normalizeLower_(value) {
    return String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  }

  function normalizeText_(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function parseFlag_(value, fallback) {
    if (value === undefined || value === null || value === "") return !!fallback;
    const raw = String(value).trim().toLowerCase();
    return raw === "si" || raw === "true" || raw === "1" || raw === "yes" || raw === "on";
  }

  function toIsoDateText_(value) {
    const raw = normalizeText_(value);
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}t/i.test(raw)) return raw.split("T")[0];
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return raw;
    return parsed.toISOString().split("T")[0];
  }

  function normalizeDuration_(value) {
    const num = Number(value);
    if (!isFinite(num) || num <= 0) return 30;
    return Math.round(num);
  }

  function durationLabel_(value) {
    const mins = normalizeDuration_(value);
    if (mins === 30) return "30 minutos";
    if (mins % 60 === 0) {
      const hours = mins / 60;
      return hours + " " + (hours === 1 ? "hora" : "horas");
    }
    return mins + " minutos";
  }

  function getSupabaseConfig_() {
    const raw = window.VF_SUPABASE_CONFIG || {};
    return {
      enabled: !!raw.enabled,
      url: String(raw.url || "").trim().replace(/\/+$/, ""),
      anonKey: String(raw.anonKey || "").trim(),
      features: raw.features || {}
    };
  }

  function isSupabaseFeatureEnabled_(featureName) {
    const cfg = getSupabaseConfig_();
    return !!(cfg.enabled && cfg.url && cfg.anonKey && cfg.features && cfg.features[featureName] === true);
  }

  function canUseSupabaseForAdminReads_(requester) {
    const role = getCurrentRole_();
    if (role === "superadmin" || role === "admin" || role === "doctor") {
      return !!String(requester || "").trim();
    }
    return false;
  }

  function canUseSupabaseForPatientReads_(requester) {
    const role = getCurrentRole_();
    return role === "paciente" && !!String(requester || "").trim();
  }

  async function apiFallback_(payload) {
    const r = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
    return r.json();
  }

  function mergeByKey_(primaryList, secondaryList, keyResolver) {
    const map = {};
    const out = [];

    function pushItem_(item) {
      if (!item) return;
      const key = String(keyResolver(item) || "").trim();
      if (!key) return;
      if (map[key]) {
        out[map[key].index] = item;
        return;
      }
      map[key] = { index: out.length };
      out.push(item);
    }

    (primaryList || []).forEach(pushItem_);
    (secondaryList || []).forEach(pushItem_);
    return out;
  }

  async function supabaseSelect_(tableName, selectClause, options) {
    const cfg = getSupabaseConfig_();
    const opts = options || {};
    const query = [];
    query.push("select=" + encodeURIComponent(selectClause));
    if (Array.isArray(opts.filters)) {
      opts.filters.forEach(function(filter) {
        if (!filter || !filter.column) return;
        const op = String(filter.op || "eq").trim() || "eq";
        const val = String(filter.value === undefined || filter.value === null ? "" : filter.value).trim();
        query.push(encodeURIComponent(filter.column) + "=" + encodeURIComponent(op + "." + val));
      });
    }
    if (opts.orderBy) {
      query.push("order=" + encodeURIComponent(opts.orderBy + (opts.ascending === false ? ".desc" : ".asc")));
    }
    if (opts.limit) {
      query.push("limit=" + encodeURIComponent(String(opts.limit)));
    }

    const url = cfg.url + "/rest/v1/" + encodeURIComponent(tableName) + "?" + query.join("&");
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      const txt = await res.text().catch(function () { return ""; });
      throw new Error("Supabase " + tableName + " " + res.status + ": " + txt);
    }

    return res.json();
  }

  function normalizeServiceRow_(row) {
    const out = {
      id: String((row && row.id) || "").trim(),
      nombre_servicio: String((row && row.nombre_servicio) || "").trim(),
      recomendaciones: String((row && row.recomendaciones) || "").trim(),
      titulo_reporte: String((row && row.titulo_reporte) || "").trim(),
      scope_visibility: String((row && row.scope_visibility) || "ALL").trim().toUpperCase(),
      owner_usuario: normalizeLower_(row && row.owner_usuario),
      duracion_minutos: normalizeDuration_(row && row.duracion_minutos)
    };
    if (out.scope_visibility !== "OWNER" && out.scope_visibility !== "ALL") {
      out.scope_visibility = "ALL";
    }
    out.duracion_label = durationLabel_(out.duracion_minutos);
    return out;
  }

  function filterServicesForRequester_(rows, requester) {
    const role = getCurrentRole_();
    const requesterNorm = normalizeLower_(requester);
    const normalizedRows = (rows || []).map(normalizeServiceRow_).filter(function (row) {
      return !!row.nombre_servicio;
    });

    if (role === "superadmin") return normalizedRows;
    if (role === "admin" || role === "doctor") {
      return normalizedRows.filter(function (row) {
        return row.scope_visibility === "ALL" || (requesterNorm && row.owner_usuario === requesterNorm);
      });
    }
    return [];
  }

  function buildServiceConfigMap_(rows) {
    const map = {};
    (rows || []).forEach(function (row) {
      const serviceName = String((row && row.servicio) || "").trim();
      if (!serviceName) return;
      if (!map[serviceName]) map[serviceName] = [];
      map[serviceName].push({
        nombre: String((row && row.campo_nombre) || "").trim(),
        etiqueta: String((row && row.campo_etiqueta) || "").trim(),
        tipo: String((row && row.campo_tipo) || "").trim().toLowerCase(),
        opciones: String((row && row.opciones) || "").trim()
      });
    });
    return map;
  }

  function normalizePromotionRow_(row) {
    return {
      id: normalizeText_(row && row.id_promo),
      mensaje: normalizeText_(row && row.mensaje),
      inicio: toIsoDateText_(row && row.fecha_inicio),
      fin: toIsoDateText_(row && row.fecha_fin),
      scope_visibility: normalizeText_(row && row.scope_visibility).toUpperCase() === "ALL" ? "ALL" : "OWNER",
      owner_usuario: normalizeLower_(row && row.owner_usuario),
      fecha_creacion: toIsoDateText_(row && row.fecha_creacion)
    };
  }

  function normalizeInfographicRow_(row) {
    const sourceUrl = normalizeText_(row && row.btn_source_url) || normalizeText_(row && row.btn_info_url);
    return {
      id_post: normalizeText_(row && row.id_post),
      doctor_usuario: normalizeLower_(row && row.doctor_usuario),
      scope_visibility: normalizeText_(row && row.scope_visibility).toUpperCase() === "ALL" ? "ALL" : "OWNER",
      activo: parseFlag_(row && row.activo, true),
      titulo: normalizeText_(row && row.titulo),
      mensaje: normalizeText_(row && row.mensaje),
      imagen_url: normalizeText_(row && row.imagen_url),
      imagen_file_id: normalizeText_(row && row.imagen_file_id),
      show_btn_agenda: parseFlag_(row && row.show_btn_agenda, true),
      btn_agenda_text: normalizeText_(row && row.btn_agenda_text) || "Agenda tu cita",
      show_btn_info: parseFlag_(row && row.show_btn_info, true),
      btn_info_text: normalizeText_(row && row.btn_info_text) || "Mas informacion",
      btn_info_url: normalizeText_(row && row.btn_info_url),
      show_btn_source: parseFlag_(row && row.show_btn_source, !!sourceUrl),
      btn_source_text: normalizeText_(row && row.btn_source_text) || "Ir a fuente",
      btn_source_url: sourceUrl,
      show_btn_contacto: parseFlag_(row && row.show_btn_contacto, true),
      btn_contacto_text: normalizeText_(row && row.btn_contacto_text) || "Contactanos",
      fecha_creacion: toIsoDateText_(row && row.fecha_creacion),
      fecha_actualizacion: toIsoDateText_(row && row.fecha_actualizacion)
    };
  }

  function sortInfographicsDesc_(rows) {
    return (rows || []).slice().sort(function(a, b) {
      const aKey = normalizeText_(a.fecha_actualizacion || a.fecha_creacion);
      const bKey = normalizeText_(b.fecha_actualizacion || b.fecha_creacion);
      return bKey.localeCompare(aKey);
    });
  }

  function buildVacationResponse_(doctorUser, row) {
    const fechaHasta = toIsoDateText_(row && row.fecha_hasta);
    const activeFlag = parseFlag_(row && row.activo, false);
    const today = new Date().toISOString().split("T")[0];
    const active = !!(activeFlag && fechaHasta && today <= fechaHasta);
    return {
      success: true,
      doctor_usuario: normalizeLower_(doctorUser),
      active: active,
      fecha_hasta: fechaHasta,
      titulo: normalizeText_(row && row.titulo) || "Aviso importante",
      mensaje: normalizeText_(row && row.mensaje) || "",
      fecha_actualizacion: toIsoDateText_(row && row.fecha_actualizacion),
      block_message: active ? ("No se pueden agendar citas hasta " + fechaHasta + ".") : ""
    };
  }

  function getCurrentPatientOwner_() {
    const session = getSessionSafe_();
    return normalizeLower_(session && session.data && session.data.creado_por);
  }

  async function getServices(requester) {
    const payload = { action: "get_services", requester: requester };
    if (!isSupabaseFeatureEnabled_("services") || !canUseSupabaseForAdminReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const results = await Promise.allSettled([
        supabaseSelect_(
          "servicios",
          "id,nombre_servicio,recomendaciones,titulo_reporte,scope_visibility,owner_usuario,duracion_minutos",
          { orderBy: "nombre_servicio" }
        ),
        apiFallback_(payload)
      ]);

      const supabaseRows = results[0].status === "fulfilled"
        ? filterServicesForRequester_(results[0].value, requester)
        : [];
      const apiRows = (results[1].status === "fulfilled" && results[1].value && results[1].value.success && Array.isArray(results[1].value.data))
        ? results[1].value.data
        : [];

      const merged = mergeByKey_(supabaseRows, apiRows, function(item) {
        return String(item.nombre_servicio || item.id || "").trim().toLowerCase();
      });

      if (merged.length) return { success: true, data: merged, source: "hybrid" };
      return apiFallback_(payload);
    } catch (e) {
      console.warn("vfDataBridge.getServices fallback:", e);
      return apiFallback_(payload);
    }
  }

  async function getServiceConfig(requester) {
    const payload = { action: "get_service_config", requester: requester };
    if (!isSupabaseFeatureEnabled_("serviceConfig") || !canUseSupabaseForAdminReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const results = await Promise.allSettled([
        supabaseSelect_(
          "config_campos",
          "servicio,campo_nombre,campo_etiqueta,campo_tipo,opciones",
          { orderBy: "servicio" }
        ),
        apiFallback_(payload)
      ]);

      const supabaseMap = results[0].status === "fulfilled"
        ? buildServiceConfigMap_(results[0].value)
        : {};
      const apiMap = (results[1].status === "fulfilled" && results[1].value && results[1].value.success && results[1].value.data)
        ? results[1].value.data
        : {};

      const merged = {};
      Object.keys(supabaseMap).forEach(function(serviceName) {
        merged[serviceName] = (supabaseMap[serviceName] || []).slice();
      });
      Object.keys(apiMap).forEach(function(serviceName) {
        const current = merged[serviceName] || [];
        const extra = Array.isArray(apiMap[serviceName]) ? apiMap[serviceName] : [];
        merged[serviceName] = mergeByKey_(current, extra, function(item) {
          return String(item.nombre || "").trim().toLowerCase();
        });
      });

      if (Object.keys(merged).length) return { success: true, data: merged, source: "hybrid" };
      return apiFallback_(payload);
    } catch (e) {
      console.warn("vfDataBridge.getServiceConfig fallback:", e);
      return apiFallback_(payload);
    }
  }

  async function getPromoList(requester) {
    const payload = { action: "get_promo_list", requester: requester };
    if (!isSupabaseFeatureEnabled_("promoList") || !canUseSupabaseForAdminReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const role = getCurrentRole_();
      const req = normalizeLower_(requester);
      const results = await Promise.allSettled([
        supabaseSelect_(
          "config_promociones",
          "id_promo,mensaje,fecha_inicio,fecha_fin,fecha_creacion,scope_visibility,owner_usuario",
          { orderBy: "fecha_creacion", ascending: false }
        ),
        apiFallback_(payload)
      ]);

      const supabaseList = (results[0].status === "fulfilled" ? results[0].value : []).map(normalizePromotionRow_).filter(function(row) {
        if (!row.id) return false;
        if (role === "superadmin") return true;
        return !!req && (!row.owner_usuario || row.owner_usuario === req);
      });
      const apiList = (results[1].status === "fulfilled" && results[1].value && results[1].value.success && Array.isArray(results[1].value.list))
        ? results[1].value.list
        : [];

      const merged = mergeByKey_(supabaseList, apiList, function(item) {
        return String(item.id || "").trim().toLowerCase();
      });

      if (merged.length || supabaseList.length || apiList.length) {
        return { success: true, list: merged, source: "hybrid" };
      }
      return apiFallback_(payload);
    } catch (e) {
      console.warn("vfDataBridge.getPromoList fallback:", e);
      return apiFallback_(payload);
    }
  }

  async function getMyVacation(requester) {
    const payload = { action: "get_my_vacation", requester: requester };
    if (!isSupabaseFeatureEnabled_("adminVacation") || !canUseSupabaseForAdminReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const doctorUser = normalizeLower_(requester);
      const results = await Promise.allSettled([
        supabaseSelect_(
          "config_vacaciones",
          "doctor_usuario,activo,fecha_hasta,titulo,mensaje,fecha_actualizacion",
          {
            filters: [{ column: "doctor_usuario", op: "eq", value: doctorUser }],
            orderBy: "fecha_actualizacion",
            ascending: false,
            limit: 1
          }
        ),
        apiFallback_(payload)
      ]);

      const supabaseResult = (results[0].status === "fulfilled" && results[0].value && results[0].value.length)
        ? buildVacationResponse_(doctorUser, results[0].value[0])
        : {
            success: true,
            doctor_usuario: doctorUser,
            active: false,
            fecha_hasta: "",
            titulo: "",
            mensaje: "",
            fecha_actualizacion: "",
            block_message: ""
          };
      if (supabaseResult.active) {
        supabaseResult.source = "supabase";
        return supabaseResult;
      }

      const apiResult = results[1].status === "fulfilled" ? results[1].value : null;
      if (apiResult && apiResult.success) {
        apiResult.source = "api";
        return apiResult;
      }

      supabaseResult.source = "supabase";
      return supabaseResult;
    } catch (e) {
      console.warn("vfDataBridge.getMyVacation fallback:", e);
      return apiFallback_(payload);
    }
  }

  async function getInfographicPostsAdmin(requester) {
    const payload = { action: "get_infographic_posts_admin", requester: requester };
    if (!isSupabaseFeatureEnabled_("adminInfographics") || !canUseSupabaseForAdminReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const role = getCurrentRole_();
      const req = normalizeLower_(requester);
      const results = await Promise.allSettled([
        supabaseSelect_(
          "config_infografias",
          "id_post,doctor_usuario,scope_visibility,activo,titulo,mensaje,imagen_url,btn_agenda_text,btn_info_text,btn_info_url,btn_contacto_text,fecha_creacion,fecha_actualizacion,imagen_file_id,show_btn_agenda,show_btn_info,show_btn_contacto,show_btn_source,btn_source_text,btn_source_url",
          { orderBy: "fecha_actualizacion", ascending: false }
        ),
        apiFallback_(payload)
      ]);

      const supabaseList = (results[0].status === "fulfilled" ? results[0].value : []).map(normalizeInfographicRow_).filter(function(row) {
        if (!row.id_post) return false;
        if (role === "superadmin") return true;
        return !!req && row.doctor_usuario === req;
      });
      const apiList = (results[1].status === "fulfilled" && results[1].value && results[1].value.success && Array.isArray(results[1].value.list))
        ? results[1].value.list
        : [];

      const merged = sortInfographicsDesc_(mergeByKey_(supabaseList, apiList, function(item) {
        return String(item.id_post || "").trim().toLowerCase();
      }));

      if (merged.length || supabaseList.length || apiList.length) {
        return { success: true, list: merged, source: "hybrid" };
      }
      return apiFallback_(payload);
    } catch (e) {
      console.warn("vfDataBridge.getInfographicPostsAdmin fallback:", e);
      return apiFallback_(payload);
    }
  }

  async function getActivePromotionForPatient(requester) {
    const payload = { action: "get_active_promotion", requester: requester };
    if (!isSupabaseFeatureEnabled_("patientPromo") || !canUseSupabaseForPatientReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const doctorOwner = getCurrentPatientOwner_();
      if (!doctorOwner) return apiFallback_(payload);

      const results = await Promise.allSettled([
        supabaseSelect_(
          "config_promociones",
          "id_promo,mensaje,fecha_inicio,fecha_fin,fecha_creacion,scope_visibility,owner_usuario",
          { orderBy: "fecha_creacion", ascending: false }
        ),
        apiFallback_(payload)
      ]);

      const today = new Date().toISOString().split("T")[0];
      const promos = (results[0].status === "fulfilled" ? results[0].value : []).map(normalizePromotionRow_);
      for (let i = promos.length - 1; i >= 0; i--) {
        const p = promos[i];
        if (!p.id || !p.inicio || !p.fin) continue;
        if (!(today >= p.inicio && today <= p.fin)) continue;
        if (p.scope_visibility === "ALL" || (p.owner_usuario && p.owner_usuario === doctorOwner)) {
          return {
            success: true,
            active: true,
            id: p.id,
            mensaje: p.mensaje,
            fin: p.fin,
            scope_visibility: p.scope_visibility,
            source: "supabase"
          };
        }
      }

      const apiResult = results[1].status === "fulfilled" ? results[1].value : null;
      if (apiResult && apiResult.success) {
        apiResult.source = "api";
        return apiResult;
      }

      return { success: true, active: false, source: "supabase" };
    } catch (e) {
      console.warn("vfDataBridge.getActivePromotionForPatient fallback:", e);
      return apiFallback_(payload);
    }
  }

  async function getDoctorVacationForPatient(requester) {
    const payload = { action: "get_my_doctor_vacation", requester: requester };
    if (!isSupabaseFeatureEnabled_("patientDoctorVacation") || !canUseSupabaseForPatientReads_(requester)) {
      return apiFallback_(payload);
    }

    try {
      const doctorOwner = getCurrentPatientOwner_();
      if (!doctorOwner) {
        return {
          success: true,
          doctor_usuario: "",
          active: false,
          fecha_hasta: "",
          titulo: "",
          mensaje: "",
          fecha_actualizacion: "",
          block_message: "",
          source: "supabase"
        };
      }

      const results = await Promise.allSettled([
        supabaseSelect_(
          "config_vacaciones",
          "doctor_usuario,activo,fecha_hasta,titulo,mensaje,fecha_actualizacion",
          {
            filters: [{ column: "doctor_usuario", op: "eq", value: doctorOwner }],
            orderBy: "fecha_actualizacion",
            ascending: false,
            limit: 1
          }
        ),
        apiFallback_(payload)
      ]);

      const supabaseResult = (results[0].status === "fulfilled" && results[0].value && results[0].value.length)
        ? buildVacationResponse_(doctorOwner, results[0].value[0])
        : {
            success: true,
            doctor_usuario: doctorOwner,
            active: false,
            fecha_hasta: "",
            titulo: "",
            mensaje: "",
            fecha_actualizacion: "",
            block_message: ""
          };

      if (supabaseResult.active) {
        supabaseResult.source = "supabase";
        return supabaseResult;
      }

      const apiResult = results[1].status === "fulfilled" ? results[1].value : null;
      if (apiResult && apiResult.success) {
        apiResult.source = "api";
        return apiResult;
      }

      supabaseResult.source = "supabase";
      return supabaseResult;
    } catch (e) {
      console.warn("vfDataBridge.getDoctorVacationForPatient fallback:", e);
      return apiFallback_(payload);
    }
  }

  window.vfDataBridge = {
    getServices: getServices,
    getServiceConfig: getServiceConfig,
    getPromoList: getPromoList,
    getMyVacation: getMyVacation,
    getInfographicPostsAdmin: getInfographicPostsAdmin,
    getActivePromotionForPatient: getActivePromotionForPatient,
    getDoctorVacationForPatient: getDoctorVacationForPatient,
    isSupabaseFeatureEnabled: isSupabaseFeatureEnabled_
  };
})();
