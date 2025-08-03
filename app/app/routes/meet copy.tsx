import { useCallback, useEffect, useRef, useState } from 'react';
import { Device } from "mediasoup-client";
import { Producer, Transport, Consumer } from "mediasoup-client/types";
import { useParams } from 'react-router';

// Enhanced interfaces
export interface MessageData {
    action: string;
    data?: any;
    id?: string;
}

export interface RemotePeer {
    id: string;
    name: string;
    videoConsumer?: Consumer;
    audioConsumer?: Consumer;
    videoStream?: MediaStream;
    audioStream?: MediaStream;
    isProducing: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
}

// Helper function to send messages to the WebSocket server
function sendMessage(ws: WebSocket, action: string, data?: any) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action, data }));
    }
}

const MeetComponent = () => {
    let params = useParams()

    // Refs for core WebRTC objects
    const deviceRef = useRef<Device | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const sendTransportRef = useRef<Transport | null>(null);
    const recvTransportRef = useRef<Transport | null>(null);
    const videoProducerRef = useRef<Producer | null>(null);
    const audioProducerRef = useRef<Producer | null>(null);

    // Enhanced state for remote peers and consumers
    const [roomInfo, setRoomInfo] = useState<any>(null);
    const [peerInfo, setPeerInfo] = useState<any>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
    const [consumers, setConsumers] = useState<Map<string, Consumer>>(new Map());
    const [consumedProducerIds, setConsumedProducerIds] = useState<Set<string>>(new Set());
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [transportsCreated, setTransportsCreated] = useState(false);

    /**
     * Updates peer information when new peers join
     */
    const updatePeerInfo = useCallback((peers: any[]) => {
        setRemotePeers(prevRemotePeers => {
            const newRemotePeers = new Map(prevRemotePeers);

            // Add new peers
            peers.forEach(peer => {
                if (!newRemotePeers.has(peer.id)) {
                    newRemotePeers.set(peer.id, {
                        id: peer.id,
                        name: peer.name,
                        isProducing: false,
                        hasVideo: false,
                        hasAudio: false,
                    });
                } else {
                    // Update existing peer name but preserve other properties
                    const existingPeer = newRemotePeers.get(peer.id)!;
                    existingPeer.name = peer.name;
                    newRemotePeers.set(peer.id, existingPeer);
                }
            });

            return newRemotePeers;
        });
    }, []);

    /**
     * Handles consuming remote media streams
     */
    const handleConsume = useCallback(async (data: any) => {
        const { id, producerId, kind, rtpParameters, peer } = data;

        // Check if we already consumed this producer
        if (consumedProducerIds.has(producerId)) {
            console.warn('[Client] Already consuming producer:', producerId);
            return;
        }

        try {
            console.log(`[Client] Creating ${kind} consumer for producer ${producerId}`);

            // Create the consumer
            const consumer = await recvTransportRef.current!.consume({
                id,
                producerId,
                kind,
                rtpParameters,
            });

            // Get the media track
            const track = consumer.track;
            console.log(`[Client] Consumer track received:`, track);

            // Update all related state in a single atomic operation
            setRemotePeers(prevPeers => {
                const newPeers = new Map(prevPeers);

                // Get or create the peer
                let peerData = newPeers.get(peer.id);
                if (!peerData) {
                    peerData = {
                        id: peer.id,
                        name: peer.name || `Peer ${peer.id}`,
                        isProducing: false,
                        hasVideo: false,
                        hasAudio: false,
                    };
                }

                // Update producing status
                peerData.isProducing = true;

                // Get or create the appropriate stream
                let targetStream: MediaStream;
                if (kind === 'video') {
                    if (!peerData.videoStream) {
                        peerData.videoStream = new MediaStream();
                    }
                    targetStream = peerData.videoStream;
                    peerData.videoConsumer = consumer;
                    peerData.hasVideo = true;
                } else {
                    if (!peerData.audioStream) {
                        peerData.audioStream = new MediaStream();
                    }
                    targetStream = peerData.audioStream;
                    peerData.audioConsumer = consumer;
                    peerData.hasAudio = true;
                }

                // Add the track to the stream
                targetStream.addTrack(track);

                // Update the peer in the map
                newPeers.set(peer.id, peerData);

                return newPeers;
            });

            // Store the consumer in a separate state update
            setConsumers(prevConsumers => {
                const newConsumers = new Map(prevConsumers);
                newConsumers.set(consumer.id, consumer);
                return newConsumers;
            });

            // Mark this producer as consumed
            setConsumedProducerIds(prev => new Set([...prev, producerId]));

            // Handle consumer events
            consumer.on('transportclose', () => {
                console.log(`[Client] Consumer transport closed for ${kind}`);
                cleanupConsumer(consumer.id, peer.id, kind);
            });

            consumer.on('trackended', () => {
                console.log(`[Client] Producer closed for ${kind} consumer`);
                cleanupConsumer(consumer.id, peer.id, kind);
            });

            consumer.on('@pause', () => {
                console.log(`[Client] Producer paused for ${kind} consumer`);
                // Handle producer pause if needed
            });

            consumer.on('@resume', () => {
                console.log(`[Client] Producer resumed for ${kind} consumer`);
                // Handle producer resume if needed
            });

            console.log(`[Client] Successfully created ${kind} consumer:`, consumer.id);

        } catch (error) {
            console.error(`[Client] Error creating ${kind} consumer:`, error);
        }
    }, [recvTransportRef, consumedProducerIds]);

    /**
     * Clean up consumer and update peer state
     */
    const cleanupConsumer = useCallback((consumerId: string, peerId: string, kind: string) => {
        // Remove the consumer
        setConsumers(prev => {
            const newConsumers = new Map(prev);
            newConsumers.delete(consumerId);
            return newConsumers;
        });

        // Clean up peer data
        setRemotePeers(prevPeers => {
            const newPeers = new Map(prevPeers);
            const peerData = newPeers.get(peerId);
            if (peerData) {
                if (kind === 'video') {
                    peerData.videoConsumer = undefined;
                    peerData.hasVideo = false;
                    if (peerData.videoStream) {
                        peerData.videoStream.getTracks().forEach(track => track.stop());
                        peerData.videoStream = undefined;
                    }
                } else {
                    peerData.audioConsumer = undefined;
                    peerData.hasAudio = false;
                    if (peerData.audioStream) {
                        peerData.audioStream.getTracks().forEach(track => track.stop());
                        peerData.audioStream = undefined;
                    }
                }

                // Update producing status
                peerData.isProducing = peerData.hasVideo || peerData.hasAudio;

                newPeers.set(peerId, peerData);
            }
            return newPeers;
        });
    }, []);

    /**
     * Handle producer stopped event
     */
    const handleProducerStopped = useCallback((data: any) => {
        const { peerId, kind } = data;

        setRemotePeers(prevPeers => {
            const newPeers = new Map(prevPeers);
            const peerData = newPeers.get(peerId);
            if (peerData) {
                if (kind === 'video') {
                    peerData.hasVideo = false;
                    if (peerData.videoStream) {
                        peerData.videoStream.getTracks().forEach(track => track.stop());
                        peerData.videoStream = undefined;
                    }
                    peerData.videoConsumer = undefined;
                } else if (kind === 'audio') {
                    peerData.hasAudio = false;
                    if (peerData.audioStream) {
                        peerData.audioStream.getTracks().forEach(track => track.stop());
                        peerData.audioStream = undefined;
                    }
                    peerData.audioConsumer = undefined;
                }

                // Update producing status
                peerData.isProducing = peerData.hasVideo || peerData.hasAudio;
                newPeers.set(peerId, peerData);
            }
            return newPeers;
        });
    }, []);

    /**
     * Loads the mediasoup device with the router's RTP capabilities.
     */
    const loadDevice = useCallback(async (routerRtpCapabilities: any, roomInfo: any) => {
        try {
            const device = new Device();
            await device.load({ routerRtpCapabilities });
            deviceRef.current = device;
            console.log("Device loaded successfully", roomInfo);

            if (roomInfo?.roomId) {
                sendMessage(socketRef.current!, "sendRtpCapabilities", {
                    roomId: roomInfo.roomId,
                    rtpCapabilities: device.rtpCapabilities,
                });
            }

        } catch (error) {
            console.error("Failed to load device:", error);
        }
    }, []);

    /**
     * Starts local media capture
     */
    const startMedia = async () => {
        if (!deviceRef.current?.loaded) {
            console.error("Device not loaded yet!");
            return;
        }

        try {
            console.log("Requesting user media...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: isVideoEnabled,
                audio: isAudioEnabled
            });
            console.log("Media stream obtained:", stream);

            setLocalStream(stream);

            if (sendTransportRef.current && recvTransportRef.current) {
                setTransportsCreated(true);
            }

        } catch (error) {
            console.error("Failed to get user media:", error);
        }
    };

    /**
     * Toggle video
     */
    const toggleVideo = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    }, [localStream]);

    /**
     * Toggle audio
     */
    const toggleAudio = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    }, [localStream]);

    /**
     * Stops local media and cleans up
     */
    const stopMedia = () => {
        console.log("Stopping media...");

        // Close producers
        if (videoProducerRef.current) {
            videoProducerRef.current.close();
            videoProducerRef.current = null;
        }
        if (audioProducerRef.current) {
            audioProducerRef.current.close();
            audioProducerRef.current = null;
        }

        // Close consumers
        consumers.forEach(consumer => {
            if (!consumer.closed) {
                consumer.close();
            }
        });
        setConsumers(new Map());

        // Close transports
        if (sendTransportRef.current) {
            sendTransportRef.current.close();
            sendTransportRef.current = null;
        }
        if (recvTransportRef.current) {
            recvTransportRef.current.close();
            recvTransportRef.current = null;
        }

        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        }

        // Clear remote peers
        setRemotePeers(new Map());
        setConsumedProducerIds(new Set());
        setTransportsCreated(false);
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);

        console.log("Media stopped");
    };

    // Attach local stream to video element
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Auto-produce media when transports are ready
    useEffect(() => {
        const produceMedia = async () => {
            if (localStream && transportsCreated) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack && sendTransportRef.current && !videoProducerRef.current) {
                    console.log('[Client] Producing video track');
                    videoProducerRef.current = await sendTransportRef.current.produce({ track: videoTrack });
                }

                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && sendTransportRef.current && !audioProducerRef.current) {
                    console.log('[Client] Producing audio track');
                    audioProducerRef.current = await sendTransportRef.current.produce({ track: audioTrack });
                }
            }
        };

        produceMedia();
    }, [localStream, transportsCreated]);

    const createSendTransport = useCallback(async (socket: WebSocket, sendTransportOptions: any) => {
        const sendTransport = deviceRef.current!.createSendTransport(sendTransportOptions);
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            console.log('[Client] Send transport connecting...');

            const messageHandler = (event: any) => {
                const response = JSON.parse(event.data);
                if (response.action === 'transportConnected' &&
                    response.data.transportId === sendTransport.id) {
                    socket.removeEventListener('message', messageHandler);
                    console.log('[Client] Send transport connected');
                    callback();
                }
            };

            socket.addEventListener('message', messageHandler);

            socket.send(JSON.stringify({
                action: 'connectTransport',
                data: {
                    transportId: sendTransport.id,
                    dtlsParameters,
                },
            }));
        });

        sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
            console.log('[Client] Producing:', kind);

            const messageHandler = (event: any) => {
                const response = JSON.parse(event.data);
                if (response.action === 'produced') {
                    socket.removeEventListener('message', messageHandler);
                    console.log('[Client] Producer created:', response.data.producerId);
                    callback({ id: response.data.producerId });
                }
            };

            socket.addEventListener('message', messageHandler);

            socket.send(JSON.stringify({
                action: 'produce',
                data: {
                    transportId: sendTransport.id,
                    kind,
                    rtpParameters,
                },
            }));
        });
    }, []);

    const createRecvTransport = useCallback(async (socket: WebSocket, recvTransportOptions: any) => {
        const recvTransport = deviceRef.current!.createRecvTransport(recvTransportOptions);
        recvTransportRef.current = recvTransport;

        console.log('[Client] Receive transport created');

        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            console.log('[Client] Receive transport connecting...');

            const messageHandler = (event: any) => {
                const response = JSON.parse(event.data);
                console.log("response", response)
                if (response.action === 'transportConnected' && response.data.transportId === recvTransport.id) {
                    socket.removeEventListener('message', messageHandler);
                    console.log('[Client] Receive transport connected');
                    callback();

                    // Now ready to consume
                    socket.send(JSON.stringify({ action: 'readyToConsume' }));
                }
            };

            socket.addEventListener('message', messageHandler);

            socket.send(JSON.stringify({
                action: 'connectTransport',
                data: {
                    transportId: recvTransport.id,
                    dtlsParameters,
                },
            }));
        });
    }, []);

    /**
     * Enhanced message handler with complete consume implementation
     */
    const handleMessage = useCallback(async (socket: WebSocket, message: string) => {
        try {
            const msgData: MessageData = JSON.parse(message);
            const { action, data } = msgData;

            console.log(`[Client] Received action: ${action}`, data);

            switch (action) {
                case "connected": {
                    if (params.meetingId) {
                        setRoomInfo({ roomId: params.meetingId });
                        sendMessage(socket, "joinRoom", { roomId: params.meetingId });
                    } else {
                        sendMessage(socket, "createRoom");
                    }
                    break;
                }

                case "roomCreated": {
                    setRoomInfo({ roomId: data.roomId });
                    sendMessage(socket, "joinRoom", { roomId: data.roomId });
                    break;
                }

                case "joinedRoom": {
                    setRoomInfo({
                        roomId: data.roomId,
                        existingPeers: data.existingPeers,
                    });

                    if (data.existingPeers) {
                        updatePeerInfo(data.existingPeers);
                    }

                    setPeerInfo(data.peer);
                    await loadDevice(data.routerRtpCapabilities, {
                        roomId: data.roomId,
                        existingPeers: data.existingPeers,
                    });
                    sendMessage(socket, 'createWebRtcTransports');
                    break;
                }

                case "newPeerJoined": {
                    console.log('[Client] New peer joined:', data);
                    setRoomInfo((prevState: any) => ({
                        ...prevState,
                        existingPeers: [...(prevState.existingPeers || []), data],
                    }));
                    updatePeerInfo([data]);
                    break;
                }

                case "peerLeft": {
                    console.log('[Client] Peer left:', data);
                    setRemotePeers(prevPeers => {
                        const newPeers = new Map(prevPeers);
                        const peer = newPeers.get(data.id);
                        if (peer) {
                            // Clean up streams
                            if (peer.videoStream) {
                                peer.videoStream.getTracks().forEach(track => track.stop());
                            }
                            if (peer.audioStream) {
                                peer.audioStream.getTracks().forEach(track => track.stop());
                            }
                        }
                        newPeers.delete(data.id);
                        return newPeers;
                    });
                    setRoomInfo((prevState: any) => ({
                        ...prevState,
                        existingPeers: prevState.existingPeers?.filter((p: any) => p.id !== data.id) || [],
                    }));
                    break;
                }

                case "createWebRtcTransports": {
                    const { sendTransportOptions, recvTransportOptions } = data;
                    await createRecvTransport(socket, recvTransportOptions);
                    await createSendTransport(socket, sendTransportOptions);
                    setTransportsCreated(true);
                    break;
                }

                case "consume": {
                    await handleConsume(data);
                    break;
                }

                case "producerStopped": {
                    handleProducerStopped(data);
                    break;
                }

                case "produced": {
                    break;
                }

                case "error": {
                    console.error('[Client] Server error:', data);
                    break;
                }

                default: {
                    console.warn('[Client] Unknown action:', action);
                    break;
                }
            }
        } catch (error) {
            console.error("Failed to handle message:", error);
        }
    }, [loadDevice, createSendTransport, createRecvTransport, handleConsume, updatePeerInfo, handleProducerStopped, params.meetingId]);

    // Create a ref to hold the handleMessage function
    const handleMessageRef = useRef(handleMessage);

    // Update the ref whenever handleMessage changes
    useEffect(() => {
        handleMessageRef.current = handleMessage;
    }, [handleMessage]);

    // WebSocket connection setup
    useEffect(() => {
        // const socket = new WebSocket('ws://localhost:3001');
        const socket = new WebSocket('ws://192.168.0.105:3001');
        socketRef.current = socket;

        socket.onopen = () => console.log("WebSocket connected");
        socket.onclose = () => console.log("WebSocket disconnected");
        socket.onerror = (error) => console.error("WebSocket error:", error);
        socket.onmessage = (event) => {
            handleMessageRef.current(socket, event.data);
        };

        return () => {
            stopMedia();
            socket.close();
        };
    }, []);

    // Get producing peers and non-producing peers
    const producingPeers = Array.from(remotePeers.values()).filter(peer => peer.isProducing && peer.hasVideo);
    const nonProducingPeers = Array.from(remotePeers.values()).filter(peer => !peer.isProducing || !peer.hasVideo);
    const allPeersToShow = Array.from(remotePeers.values());

    // Determine the main peer (first producing peer or first peer)
    const mainPeer = producingPeers.length > 0 ? producingPeers[0] : (allPeersToShow.length > 0 ? allPeersToShow[0] : null);
    const otherPeers = allPeersToShow.filter(peer => peer.id !== mainPeer?.id);

    return (
        <div className="p-2 font-sans text-gray-800 min-h-screen bg-green-200">
            {/* Heading */}
            <h1 className="text-3xl font-bold text-center mb-8 text-orange-900 tracking-wide">
                MediaSoup Meeting
            </h1>

            {/* Room Info */}
            <div className="mb-6 text-center text-lg">
                <span className="text-gray-600 font-medium">Meeting ID:</span>{' '}
                <span className="text-orange-900 font-semibold">
                    {roomInfo?.roomId || 'Not connected'}
                </span>
            </div>

            {/* Video Section */}
            <div className="flex flex-col items-center gap-6 mb-10">
                {/* Main video area */}
                <div className="w-full max-w-4xl">
                    {mainPeer ? (
                        <RemotePeerVideo
                            key={mainPeer.id}
                            peer={mainPeer}
                            videoStream={mainPeer.videoStream || null}
                            audioStream={mainPeer.audioStream || null}
                            isMain={true}
                        />
                    ) : localStream ? (
                        <RemotePeerVideo
                            peer={{ id: 'local', name: peerInfo?.name || 'You', isProducing: true, hasVideo: isVideoEnabled, hasAudio: isAudioEnabled }}
                            videoStream={localStream}
                            isLocal={true}
                            isMain={true}
                        />
                    ) : (
                        <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xl">No participants</span>
                        </div>
                    )}
                </div>

                {/* Thumbnail videos */}
                <div className="flex flex-wrap gap-4 justify-center max-w-6xl">
                    {/* Local video thumbnail (only show if there's a main peer) */}
                    {localStream && mainPeer && (
                        <RemotePeerVideo
                            peer={{ id: 'local', name: peerInfo?.name || 'You', isProducing: true, hasVideo: isVideoEnabled, hasAudio: isAudioEnabled }}
                            videoStream={localStream}
                            isLocal={true}
                            isMain={false}
                        />
                    )}

                    {/* Other remote peers */}
                    {otherPeers.map(peer => (
                        <RemotePeerVideo
                            key={peer.id}
                            peer={peer}
                            videoStream={peer.videoStream || null}
                            audioStream={peer.audioStream || null}
                            isMain={false}
                        />
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="text-center space-y-4">
                {deviceRef.current?.loaded && (
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={localStream ? stopMedia : startMedia}
                            className={`px-8 py-3 text-white text-lg font-medium rounded-full shadow-sm transition-all duration-300 
                                ${localStream ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {localStream ? 'Start Camera & mic' : 'Stop Camera & mic'}
                        </button>

                        {/* {localStream && (
                            <>
                                <button
                                    onClick={toggleVideo}
                                    className={`px-6 py-3 text-white text-lg font-medium rounded-full shadow-sm transition-all duration-300 
                                        ${isVideoEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                                >
                                    {isVideoEnabled ? '📹' : '📹🚫'} Video
                                </button>

                                <button
                                    onClick={toggleAudio}
                                    className={`px-6 py-3 text-white text-lg font-medium rounded-full shadow-sm transition-all duration-300 
                                        ${isAudioEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
                                >
                                    {isAudioEnabled ? '🎤' : '🎤🚫'} Audio
                                </button>
                            </>
                        )} */}
                    </div>
                )}

                {/* Debug Info */}
                <div className="text-sm text-gray-500 mt-4">
                    <div>Consumers: {consumers.size}</div>
                    <div>Remote Peers: {remotePeers.size}</div>
                    <div>Producing Peers: {producingPeers.length}</div>
                    <div>Device Loaded: {deviceRef.current?.loaded ? 'Yes' : 'No'}</div>
                    <div>Transports Created: {transportsCreated ? 'Yes' : 'No'}</div>
                </div>
            </div>
        </div>
    );
};

/**
 * Component to render remote peer video
 */
type RemotePeerVideoProps = {
    peer: RemotePeer | { id: string; name: string; isProducing: boolean; hasVideo: boolean; hasAudio: boolean };
    videoStream: MediaStream | null;
    audioStream?: MediaStream | null;
    isLocal?: boolean;
    isMain?: boolean;
};

const RemotePeerVideo: React.FC<RemotePeerVideoProps> = ({ peer, videoStream, audioStream, isLocal, isMain = false }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (videoStream && videoRef.current) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    useEffect(() => {
        if (audioStream && audioRef.current) {
            audioRef.current.srcObject = audioStream;
        }
    }, [audioStream]);

    const hasVideoTrack = videoStream && videoStream.getVideoTracks().length > 0 && videoStream.getVideoTracks()[0].enabled;

    return (
        <div
            className={`
                relative rounded-lg overflow-hidden bg-gray-800
                ${isMain
                    ? 'w-full aspect-video'
                    : 'aspect-video w-48'
                }
                ${hasVideoTrack ? 'border-2 border-green-400' : 'border-2 border-gray-600'}
            `}
        >
            {hasVideoTrack ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-2 mx-auto">
                            <span className="text-white text-2xl font-bold">
                                {peer.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="text-white text-sm">No Camera</div>
                    </div>
                </div>
            )}

            {audioStream && !isLocal && (
                <audio ref={audioRef} autoPlay playsInline />
            )}

            <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded">
                {isLocal ? `${peer.name} (You)` : peer.name}
            </div>

            <div className="absolute top-2 right-2 flex space-x-1">
                {'hasVideo' in peer && peer.hasVideo && hasVideoTrack && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Video active" />
                )}
                {'hasAudio' in peer && peer.hasAudio && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" title="Audio active" />
                )}
            </div>
        </div>
    );
};


export default MeetComponent;