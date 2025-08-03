import * as mediasoup from 'mediasoup';
import WebSocket from 'ws';

export interface Peer {
    id: string;
    name: string;
    ws: WebSocket;
    transports: Map<string, mediasoup.types.WebRtcTransport>;
    producers: Map<string, mediasoup.types.Producer>;
    consumers: Map<string, mediasoup.types.Consumer>;
    consumedProducers: Set<string>;
    sendTransport?: mediasoup.types.WebRtcTransport;
    recvTransport?: mediasoup.types.WebRtcTransport;
    rtpCapabilities?: mediasoup.types.RtpCapabilities;
    roomId?: string;
    isReady: boolean;
    lastActivity: Date;
}

export interface Room {
    id: string;
    peers: Map<string, Peer>;
    router: mediasoup.types.Router;
    workerIndex: number;
    createdAt: Date;
    lastActivity: Date;
}

export interface MessageData {
    action: string;
    data?: any;
    id?: string;
}

// Error types
export enum ErrorType {
    ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
    ROOM_FULL = 'ROOM_FULL',
    PEER_NOT_FOUND = 'PEER_NOT_FOUND',
    TRANSPORT_ERROR = 'TRANSPORT_ERROR',
    PRODUCER_ERROR = 'PRODUCER_ERROR',
    CONSUMER_ERROR = 'CONSUMER_ERROR',
    INVALID_DATA = 'INVALID_DATA',
    SERVER_ERROR = 'SERVER_ERROR'
}