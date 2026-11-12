import net from 'net';

function scanAndGrab(host, port, timeout = 1200) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let banner = '';
        let status = 'CERRADO';

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            status = 'ABIERTO';
            socket.write(`GET / HTTP/1.1\r\nHost: ${host}\r\n\r\n`);
        });

        socket.on('data', (data) => {
            banner += data.toString();
            socket.destroy();
        });

        socket.on('timeout', () => socket.destroy());
        socket.on('error', () => socket.destroy());

        socket.on('close', () => {
            resolve({ puerto: port, estado: status, banner: banner.trim() });
        });

        socket.connect(port, host);
    });
}

function identificarServicio(puerto, banner) {
    const b = banner.toLowerCase();

    if (puerto === 3389) return { tipo: 'Escritorio Remoto (RDP)', web: false };
    if (puerto === 22) return { tipo: 'Terminal Segura (SSH)', web: false };
    if (puerto === 5900 || puerto === 5901) return { tipo: 'Control Remoto (VNC)', web: false };
    if (puerto === 554 || puerto === 8554 || b.includes('rtsp')) return { tipo: 'Stream de Video / Cámaras (RTSP)', web: false };
    if (b.includes('server: dvr') || b.includes('hikvision') || b.includes('dahua') || b.includes('netsurveillance') || [37777, 34567, 8000].includes(puerto)) {
        return { tipo: 'Grabador / Cámaras DVR-NVR', web: true };
    }
    if (b.includes('http') || [80, 443, 8080, 8081, 8443, 8888, 81, 82, 85, 88, 9000].includes(puerto)) {
        if (b.includes('cam') || b.includes('ipcamera') || b.includes('webcam')) {
            return { tipo: 'Panel Web de Cámara IP', web: true };
        }
        return { tipo: 'Panel Web / Servidor HTTP', web: true };
    }
    if (puerto === 21) return { tipo: 'Servidor Archivos (FTP)', web: false };
    if (puerto === 445) return { tipo: 'Carpetas Compartidas Windows (SMB)', web: false };

    return { tipo: 'Puerto activo / Servicio personalizado', web: true };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ipEmpresa = req.query.ip;
    const start = Math.max(1, parseInt(req.query.start) || 1);
    const end = Math.min(65535, parseInt(req.query.end) || 1000);

    if (!ipEmpresa) {
        return res.status(400).json({ error: 'Falta el parámetro ip' });
    }

    const puertos = [];
    for (let p = start; p <= end; p++) {
        puertos.push(p);
    }

    // Procesar en sub-lotes de 125 para no saturar los sockets del servidor
    const abiertos = [];
    const batchSize = 125;

    for (let i = 0; i < puertos.length; i += batchSize) {
        const lote = puertos.slice(i, i + batchSize);
        const resultados = await Promise.all(
            lote.map((p) => scanAndGrab(ipEmpresa, p, 1200))
        );

        for (const r of resultados) {
            if (r.estado === 'ABIERTO') {
                const info = identificarServicio(r.puerto, r.banner);
                abiertos.push({
                    puerto: r.puerto,
                    tipo: info.tipo,
                    es_web: info.web,
                    banner: r.banner.substring(0, 120)
                });
            }
        }
    }

    res.status(200).json({
        objetivo: ipEmpresa,
        rango: `${start}-${end}`,
        puertos_activos: abiertos
    });
}