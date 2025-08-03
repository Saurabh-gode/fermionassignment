import express from 'express';
import http from 'http';
import cors from "cors";
import WebSocket, { Server as WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ErrorType, MessageData, Peer, Room } from './types.app';
import mediaCodecs from "./constants"
import { generateRandomName } from './utils';
import { Producer } from 'mediasoup-client/lib/Producer';
import { Router } from 'mediasoup/node/lib/RouterTypes';

const app = express();
const server = http.createServer(app);
const wss: WebSocketServer = new WebSocketServer({ server });

const PORT = 3001;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(cors());
app.use(express.json());


let workers: mediasoup.types.Worker[] = [];
let rooms: Map<string, Room> = new Map();
let peers: Map<string, Peer> = new Map();
let peerCounter = 0;
let workerIndex = 0;

const CONFIG = {
    PORT: parseInt(process.env.PORT || '3001'),
    MEDIASOUP: {
        WORKER_COUNT: parseInt(process.env.MEDIASOUP_WORKERS || '2'),
        RTC_MIN_PORT: parseInt(process.env.RTC_MIN_PORT || '40000'),
        RTC_MAX_PORT: parseInt(process.env.RTC_MAX_PORT || '49999'),
        ANNOUNCED_IP: process.env.ANNOUNCED_IP || '127.0.0.1',
    },
    LIMITS: {
        MAX_PEERS_PER_ROOM: parseInt(process.env.MAX_PEERS_PER_ROOM || '50'),
        MAX_PRODUCERS_PER_PEER: parseInt(process.env.MAX_PRODUCERS_PER_PEER || '4'),
        MAX_CONSUMERS_PER_PEER: parseInt(process.env.MAX_CONSUMERS_PER_PEER || '200'),
    }
};


async function createWorkers() {
    console.log(`Creating ${CONFIG.MEDIASOUP.WORKER_COUNT} MediaSoup workers...`);

    for (let i = 0; i < CONFIG.MEDIASOUP.WORKER_COUNT; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: 'warn',
            rtcMinPort: CONFIG.MEDIASOUP.RTC_MIN_PORT,
            rtcMaxPort: CONFIG.MEDIASOUP.RTC_MAX_PORT,
        });

        worker.on('died', (error) => {
            console.error(`💀 MediaSoup Worker ${i} died:`, error);
            // Implement worker restart logic here...
        });

        workers.push(worker);
        console.log(`✅ Worker ${i} created`);
    }
}

createWorkers();
startCleanupInterval();

function sendMessage(ws: WebSocket, action: string, data?: any) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action, data }));
    }
}

function sendError(ws: WebSocket, type: ErrorType, message: string) {
    sendMessage(ws, 'error', { type, message });
}

function handleMessage(ws: WebSocket, message: WebSocket.Data, peer: Peer) {
    try {
        const data: MessageData = JSON.parse(message.toString());

        // Validate message structure
        if (!data.action || typeof data.action !== 'string') {
            throw new Error('Invalid message format');
        }

        console.log(`📨 Message from ${peer.id}: ${peer.name} - ${data.action}`);

        routeMessage(ws, data, peer);
    } catch (error) {
        console.error('Error parsing message:', error);
        sendError(ws, ErrorType.INVALID_DATA, 'Invalid message format');
    }
}

async function routeMessage(ws: WebSocket, data: MessageData, peer: Peer) {
    try {
        switch (data.action) {
            case 'createRoom':
                await handleCreateRoom(ws, peer);
                break;
            case 'joinRoom':
                await handleJoinRoom(ws, data, peer);
                break;
            case 'sendRtpCapabilities':
                await handleRtpCapabilities(ws, data, peer);
                break;
            case 'createWebRtcTransports':
                await handleCreateTransports(ws, peer);
                break;
            case 'connectTransport':
                await handleConnectTransport(ws, data, peer);
                break;
            case 'readyToConsume':
                await handleReadyToConsume(ws, peer);
                break;
            case 'produce':
                await handleProduce(ws, data, peer);
                break;
            case 'pauseProducer':
                await handlePauseProducer(ws, data, peer);
                break;
            case 'resumeProducer':
                await handleResumeProducer(ws, data, peer);
                break;
            default:
                console.warn(`⚠️ Unknown action: ${data.action}`);
                sendError(ws, ErrorType.INVALID_DATA, `Unknown action: ${data.action}`);
        }
    } catch (error) {
        console.error(`❌ Error handling ${data.action}:`, error);
        sendError(ws, ErrorType.SERVER_ERROR, 'Internal server error');
    }
}

function getNextWorker(): mediasoup.types.Worker {
    const worker = workers[workerIndex];
    workerIndex = (workerIndex + 1) % workers.length;
    return worker;
}

async function handleCreateRoom(ws: WebSocket, peer: Peer) {
    const roomId = uuidv4();
    const worker = getNextWorker();
    const router = await worker.createRouter({ mediaCodecs });

    const room: Room = {
        id: roomId,
        router,
        peers: new Map(),
        workerIndex: workerIndex,
        createdAt: new Date(),
        lastActivity: new Date(),
    };

    rooms.set(roomId, room);
    peer.roomId = roomId;
    room.peers.set(peer.id, peer);

    sendMessage(ws, 'roomCreated', {
        roomId,
        routerRtpCapabilities: router.rtpCapabilities,
    });

    console.log(`🏠 Room ${roomId} created by ${peer.id}`);
}

async function handleJoinRoom(ws: WebSocket, data: MessageData, peer: Peer) {
    const { roomId } = data.data || {};

    if (!roomId) {
        sendError(ws, ErrorType.INVALID_DATA, 'Room ID is required');
        return;
    }

    const room = rooms.get(roomId);

    if (!room) {
        sendError(ws, ErrorType.ROOM_NOT_FOUND, 'Room does not exist');
        return;
    }

    if (room.peers.size >= CONFIG.LIMITS.MAX_PEERS_PER_ROOM) {
        sendError(ws, ErrorType.ROOM_FULL, 'Room is full');
        return;
    }

    peer.roomId = roomId;
    room.peers.set(peer.id, peer);
    room.lastActivity = new Date();


    // Send room info and existing peers to new peer
    const existingPeers = Array.from(room.peers.values())
        .filter(p => p.id !== peer.id)
        .map(p => ({ id: p.id, name: p.name }));


    // Notify existing peers
    for (const otherPeer of room.peers.values()) {
        if (otherPeer.id !== peer.id) {
            sendMessage(otherPeer.ws, 'newPeerJoined', {
                id: peer.id,
                name: peer.name,
                existingPeers: Array.from(room.peers.values())
                    .filter(p => p.id !== otherPeer.id)
                    .map(p => ({ id: p.id, name: p.name }))
            });
        }
    }

    sendMessage(ws, 'joinedRoom', {
        peer: { id: peer.id, name: peer.name, },
        roomId,
        routerRtpCapabilities: room.router.rtpCapabilities,
        existingPeers,
    })

    console.log(`Peer ${peer.id} joined room ${roomId}`);
}

async function handleRtpCapabilities(ws: WebSocket, data: MessageData, peer: Peer) {
    const { rtpCapabilities } = data.data || {};

    if (!rtpCapabilities) {
        sendError(ws, ErrorType.INVALID_DATA, 'RTP capabilities are required');
        return;
    }

    peer.rtpCapabilities = rtpCapabilities;
    console.log(`RTP capabilities received from ${peer.id}`);
}

async function createWebRtcTransport(router: mediasoup.types.Router) {
    const transport = await router.createWebRtcTransport({
        listenIps: [{
            ip: '0.0.0.0',
            announcedIp: CONFIG.MEDIASOUP.ANNOUNCED_IP,
        }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000,
    });

    transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
            transport.close();
        }
    });

    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        },
    };
}

async function handleCreateTransports(ws: WebSocket, peer: Peer) {
    if (!peer.roomId) {
        sendError(ws, ErrorType.INVALID_DATA, 'Peer must be in a room');
        return;
    }

    const room = rooms.get(peer.roomId);
    if (!room) {
        sendError(ws, ErrorType.ROOM_NOT_FOUND, 'Room not found');
        return;
    }

    try {
        let sendTransport = peer.sendTransport;
        let recvTransport = peer.recvTransport;
        let sendTransportOptions, recvTransportOptions;

        // Create send transport if not already created
        if (!sendTransport) {
            const created = await createWebRtcTransport(room.router);
            sendTransport = created.transport;
            sendTransportOptions = created.params;

            peer.sendTransport = sendTransport;
            peer.transports.set(sendTransportOptions.id, sendTransport);
        } else {
            sendTransportOptions = {
                id: sendTransport.id,
                iceParameters: sendTransport.iceParameters,
                iceCandidates: sendTransport.iceCandidates,
                dtlsParameters: sendTransport.dtlsParameters,
            };
        }

        // Create recv transport if not already created
        if (!recvTransport) {
            const created = await createWebRtcTransport(room.router);
            recvTransport = created.transport;
            recvTransportOptions = created.params;

            peer.recvTransport = recvTransport;
            peer.transports.set(recvTransportOptions.id, recvTransport);
        } else {
            recvTransportOptions = {
                id: recvTransport.id,
                iceParameters: recvTransport.iceParameters,
                iceCandidates: recvTransport.iceCandidates,
                dtlsParameters: recvTransport.dtlsParameters,
            };
        }

        sendMessage(ws, 'createWebRtcTransports', {
            sendTransportOptions,
            recvTransportOptions,
        });

        console.log(`Transports ready for ${peer.id} (reused if already created)`);
    } catch (error) {
        console.error('Error handling transports:', error);
        sendError(ws, ErrorType.TRANSPORT_ERROR, 'Failed to setup transports');
    }
}

async function handleConnectTransport(ws: WebSocket, data: MessageData, peer: Peer) {
    const { transportId, dtlsParameters } = data.data || {};

    if (!transportId || !dtlsParameters) {
        sendError(ws, ErrorType.INVALID_DATA, 'Transport ID and DTLS parameters are required');
        return;
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
        sendError(ws, ErrorType.TRANSPORT_ERROR, 'Transport not found');
        return;
    }

    try {
        await transport.connect({ dtlsParameters });
        sendMessage(ws, 'transportConnected', { transportId });
        console.log(`🔗 Transport ${transportId} connected for ${peer.id}`);
    } catch (error) {
        console.error('❌ Error connecting transport:', error);
        sendError(ws, ErrorType.TRANSPORT_ERROR, 'Failed to connect transport');
    }
}


async function handleReadyToConsume(ws: WebSocket, peer: Peer) {
    if (!peer.roomId || !peer.recvTransport || !peer.rtpCapabilities) {
        sendError(ws, ErrorType.INVALID_DATA, 'Missing requirements for consuming');
        return;
    }

    const room = rooms.get(peer.roomId);
    if (!room) {
        sendError(ws, ErrorType.ROOM_NOT_FOUND, 'Room not found');
        return;
    }

    peer.isReady = true;

    // Create consumers for existing producers
    for (const otherPeer of room.peers.values()) {
        if (otherPeer.id === peer.id) {
            continue;
        }

        for (const producer of otherPeer.producers.values()) {
            await createConsumer(peer, otherPeer, producer, room.router);
        }
    }

    console.log(`🍽️ Peer ${peer.id} is ready to consume`);
}

async function handleProduce(ws: WebSocket, data: MessageData, peer: Peer) {
    const { transportId, kind, rtpParameters } = data.data || {};

    if (!transportId || !kind || !rtpParameters) {
        sendError(ws, ErrorType.INVALID_DATA, 'Missing produce parameters');
        return;
    }

    if (peer.producers.size >= CONFIG.LIMITS.MAX_PRODUCERS_PER_PEER) {
        sendError(ws, ErrorType.PRODUCER_ERROR, 'Maximum producers reached');
        return;
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
        sendError(ws, ErrorType.TRANSPORT_ERROR, 'Transport not found');
        return;
    }

    const room = rooms.get(peer.roomId!);
    if (!room) {
        sendError(ws, ErrorType.ROOM_NOT_FOUND, 'Room not found');
        return;
    }

    try {
        const producer = await transport.produce({ kind, rtpParameters });
        peer.producers.set(producer.id, producer);

        // Create consumers for other ready peers
        for (const otherPeer of room.peers.values()) {
            if (otherPeer.id !== peer.id && otherPeer.isReady) {
                await createConsumer(otherPeer, peer, producer, room.router);
            }
        }

        sendMessage(ws, 'produced', { producerId: producer.id });
        console.log(`🎥 Producer ${producer.id} created for ${peer.id}`);
    } catch (error) {
        console.error('❌ Error creating producer:', error);
        sendError(ws, ErrorType.PRODUCER_ERROR, 'Failed to create producer');
    }
}

async function handlePauseProducer(ws: WebSocket, data: MessageData, peer: Peer) {
    const { producerId } = data.data || {};
    const producer = peer.producers.get(producerId);

    if (!producer) {
        sendError(ws, ErrorType.PRODUCER_ERROR, 'Producer not found');
        return;
    }

    await producer.pause();
    sendMessage(ws, 'producerPaused', { producerId });
    console.log(`⏸️ Producer ${producerId} paused for ${peer.id}`);
}

async function handleResumeProducer(ws: WebSocket, data: MessageData, peer: Peer) {
    const { producerId } = data.data || {};
    const producer = peer.producers.get(producerId);

    if (!producer) {
        sendError(ws, ErrorType.PRODUCER_ERROR, 'Producer not found');
        return;
    }

    await producer.resume();
    sendMessage(ws, 'producerResumed', { producerId });
    console.log(`▶️ Producer ${producerId} resumed for ${peer.id}`);
}

async function createConsumer(peer: Peer, producerPeer: Peer, producer: mediasoup.types.Producer, router: mediasoup.types.Router) {
    console.log("creating consumer")
    if (!peer.recvTransport || !peer.rtpCapabilities) {
        console.log("!peer.recvTransport || !peer.rtpCapabilities")
        return;
    }

    if (peer.consumedProducers.has(producer.id)) {
        console.log("peer.consumedProducers.has(producer.id)")
        return;
    }

    if (!router.canConsume({
        producerId: producer.id,
        rtpCapabilities: peer.rtpCapabilities
    })) {
        console.log("canconsume")
        return;
    }

    if (peer.consumers.size >= CONFIG.LIMITS.MAX_CONSUMERS_PER_PEER) {
        console.warn(`⚠️ Max consumers reached for peer ${peer.id}`);
        return;
    }

    try {
        const consumer = await peer.recvTransport.consume({
            producerId: producer.id,
            rtpCapabilities: peer.rtpCapabilities,
            paused: false,
        });

        peer.consumers.set(consumer.id, consumer);
        peer.consumedProducers.add(producer.id);

        sendMessage(peer.ws, 'consume', {
            producerId: producer.id,
            peer: { id: producerPeer.id, name: producerPeer.name },
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        });

        console.log(`🍽️ Consumer ${consumer.id} created for ${peer.id}`);
    } catch (error) {
        console.error('❌ Error creating consumer:', error);
    }
}

function cleanupPeer(peer: Peer) {
    try {
        // Close all resources
        for (const transport of peer.transports.values()) {
            if (!transport.closed) transport.close();
        }

        for (const producer of peer.producers.values()) {
            if (!producer.closed) producer.close();
        }

        for (const consumer of peer.consumers.values()) {
            if (!consumer.closed) consumer.close();
        }

        // Remove from room
        if (peer.roomId) {
            const room = rooms.get(peer.roomId);
            if (room) {
                room.peers.delete(peer.id);

                // Notify others
                for (const otherPeer of room.peers.values()) {
                    sendMessage(otherPeer.ws, 'peerLeft', {
                        id: peer.id,
                        name: peer.name
                    });
                }

                // Clean up empty room
                if (room.peers.size === 0) {
                    console.log(`🏠 Room ${peer.roomId} is empty, cleaning up...`);
                    room.router.close();
                    rooms.delete(peer.roomId);
                }
            }
        }

        peers.delete(peer.id);
        console.log(`🧹 Peer ${peer.id} cleaned up`);
    } catch (error) {
        console.error('❌ Error cleaning up peer:', error);
    }
}

function startCleanupInterval() {
    setInterval(() => {
        const now = new Date();
        const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

        // // Clean up inactive peers
        // for (const peer of peers.values()) {
        //     if (now.getTime() - peer.lastActivity.getTime() > INACTIVE_THRESHOLD) {
        //         console.log(`🧹 Cleaning up inactive peer ${peer.id}`);
        //         cleanupPeer(peer);
        //     }
        // }

        // Clean up empty rooms
        for (const [roomId, room] of rooms.entries()) {
            if (room.peers.size === 0 &&
                now.getTime() - room.lastActivity.getTime() > INACTIVE_THRESHOLD) {
                console.log(`🏠 Cleaning up empty room ${roomId}`);
                room.router.close();
                rooms.delete(roomId);
            }
        }
    }, 60000); // Run every minute
}


// async function ffmpegStreamer(router: mediasoup.types.Router, producer: Producer) {

//     const plainTransport = await router.createPlainTransport({
//         listenIp: {
//             ip: '0.0.0.0',
//             announcedIp: CONFIG.MEDIASOUP.ANNOUNCED_IP,
//         },
//         rtcpMux: false,
//         comedia: true, // important: FFmpeg will send packets first
//     });

//     await plainTransport.connect({
//         ip: '127.0.0.1',
//         port: 5004, // FFmpeg RTP port
//         rtcpPort: 5005, // FFmpeg RTCP port
//     });

//     const consumer = await plainTransport.consume({
//         producerId: producer.id,
//         rtpCapabilities: router.rtpCapabilities,
//         paused: false,
//     });

//     return {
//         consumer
//     }

// }

wss.on('connection', (ws, request) => {
    const clientIp = request.socket.remoteAddress;
    console.log(`🔗 New client connected from ${clientIp}`);

    const peerId = `peer-${++peerCounter}`;
    const peer: Peer = {
        id: peerId,
        name: generateRandomName(),
        ws,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        consumedProducers: new Set(),
        isReady: true,
        lastActivity: new Date(),
    };

    peers.set(peerId, peer);

    // Set up message handling
    ws.on('message', (message) => {
        peer.lastActivity = new Date();
        handleMessage(ws, message, peer);
    });

    ws.on('close', () => {
        console.log(`Client ${peerId} disconnected`);
        cleanupPeer(peer);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for peer ${peerId}:`, error);
        cleanupPeer(peer);
    });

    // Send welcome message
    sendMessage(ws, 'connected', { peerId, name: peer.name });
});


server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://192.168.0.105:${PORT}`);
});

