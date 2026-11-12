import net from 'net';

function scanAndGrab(host, port, timeout = 3000) {
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
    if (puerto === 5900) return { tipo: 'Control Remoto (VNC)', web: false };
    if (puerto === 554 || b.includes('rtsp')) return { tipo: 'Stream de Video / Cámaras (RTSP)', web: false };
    if (b.includes('server: dvr') || b.includes('hikvision') || b.includes('dahua') || b.includes('netsurveillance')) {
        return { tipo: 'Grabador / Cámaras DVR-NVR', web: true };
    }
    if (b.includes('http') || [80, 443, 8080, 8443, 8000, 8888, 85, 9000].includes(puerto)) {
        if (b.includes('cam') || b.includes('ipcamera') || b.includes('webcam')) {
            return { tipo: 'Panel Web de Cámara IP', web: true };
        }
        return { tipo: 'Panel Web / Posible Cámara', web: true };
    }
    if (puerto === 21) return { tipo: 'Servidor Archivos (FTP)', web: false };

    return { tipo: 'Servicio activo / Puerto personalizado', web: true };
}

export default async function handler(req, res) {
    // Permitir peticiones desde tu dashboard local o GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ipEmpresa = req.query.ip;
    if (!ipEmpresa) {
        return res.status(400).json({ error: 'Falta el parámetro ip' });
    }

    // Lista ampliada de puertos típicos de cámaras, DVRs, web y escritorio remoto
    const puertosAComprobar = [
        80, 443, 81, 82, 85, 88, 554, 8000, 8001, 8080, 8081, 8443, 8888, 9000, 37777, 34567, 3389, 22, 5900, 21
    ];

    const resultadosBrutos = await Promise.all(
        puertosAComprobar.map((puerto) => scanAndGrab(ipEmpresa, puerto))
    );

    const analizados = resultadosBrutos
        .filter(r => r.estado === 'ABIERTO')
        .map(r => {
            const info = identificarServicio(r.puerto, r.banner);
            return {
                puerto: r.puerto,
                tipo: info.tipo,
                es_web: info.web,
                banner: r.banner.substring(0, 120)
            };
        });

    res.status(200).json({
        objetivo: ipEmpresa,
        total_abiertos: analizados.length,
        puertos_activos: analizados
    });
}
