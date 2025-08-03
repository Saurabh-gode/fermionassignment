import { RouterRtpCodecCapability, MediaKind, RtcpFeedback } from 'mediasoup/node/lib/rtpParametersTypes';

// ✅ Type-safe codec configuration based on official MediaSoup types
// Using RouterRtpCodecCapability where preferredPayloadType is optional

export const mediaCodecs: RouterRtpCodecCapability[] = [
    // Audio Codecs
    {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
            'sprop-stereo': 1,
            'stereo': 1,
            'useinbandfec': 1,
            'usedtx': 1,
        },
        rtcpFeedback: [
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 111, // Optional but recommended
    },
    {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/PCMU',
        clockRate: 8000,
        channels: 1,
        parameters: {},
        rtcpFeedback: [],
        preferredPayloadType: 0,
    },
    {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/PCMA',
        clockRate: 8000,
        channels: 1,
        parameters: {},
        rtcpFeedback: [],
        preferredPayloadType: 8,
    },
    {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/G722',
        clockRate: 8000,
        channels: 1,
        parameters: {},
        rtcpFeedback: [],
        preferredPayloadType: 9,
    },
    {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/CN',
        clockRate: 8000,
        channels: 1,
        parameters: {},
        rtcpFeedback: [],
        preferredPayloadType: 13,
    },

    // Video Codecs - VP9 (Most efficient)
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
            'profile-id': 0,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 101,
    },
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
            'profile-id': 1,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 102,
    },

    // Video Codecs - VP8 (Good compatibility)
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {},
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 96,
    },

    // Video Codecs - H.264 (Maximum compatibility)
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42001f', // Baseline profile, level 3.1
            'level-asymmetry-allowed': 1,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 103,
    },
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f', // Extended baseline profile
            'level-asymmetry-allowed': 1,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 104,
    },
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d001f', // Main profile
            'level-asymmetry-allowed': 1,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 105,
    },
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
            'packetization-mode': 1,
            'profile-level-id': '640032', // High profile
            'level-asymmetry-allowed': 1,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 106,
    },

    // Future codecs (limited browser support)
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/H265',
        clockRate: 90000,
        parameters: {
            'profile-id': 1,
            'tier-flag': 0,
            'level-id': 120,
            'tx-mode': 'SRST',
            'max-recv-level-id': 120,
            'max-recv-temporal-id': 0,
        },
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 107,
    },
    {
        kind: 'video' as MediaKind,
        mimeType: 'video/AV1',
        clockRate: 90000,
        parameters: {},
        rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
            { type: 'transport-cc' },
        ],
        preferredPayloadType: 108,
    },
];

// Configuration presets for different scenarios
export const codecPresets = {
    // ✅ Minimal - Your original setup but type-safe and improved
    minimal: [
        {
            kind: 'audio' as MediaKind,
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {
                'useinbandfec': 1,
                'usedtx': 1,
            },
            rtcpFeedback: [
                { type: 'transport-cc' },
            ] as RtcpFeedback[],
        },
        {
            kind: 'video' as MediaKind,
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {},
            rtcpFeedback: [
                { type: 'nack' },
                { type: 'nack', parameter: 'pli' },
                { type: 'ccm', parameter: 'fir' },
                { type: 'goog-remb' },
                { type: 'transport-cc' },
            ] as RtcpFeedback[],
        },
    ] as RouterRtpCodecCapability[],

    // ✅ Balanced - Recommended for production
    balanced: [
        {
            kind: 'audio' as MediaKind,
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {
                'useinbandfec': 1,
                'usedtx': 1,
            },
            rtcpFeedback: [
                { type: 'transport-cc' },
            ] as RtcpFeedback[],
        },
        {
            kind: 'video' as MediaKind,
            mimeType: 'video/VP9',
            clockRate: 90000,
            parameters: {
                'profile-id': 0,
            },
            rtcpFeedback: [
                { type: 'nack' },
                { type: 'nack', parameter: 'pli' },
                { type: 'ccm', parameter: 'fir' },
                { type: 'goog-remb' },
                { type: 'transport-cc' },
            ] as RtcpFeedback[],
        },
        {
            kind: 'video' as MediaKind,
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {},
            rtcpFeedback: [
                { type: 'nack' },
                { type: 'nack', parameter: 'pli' },
                { type: 'ccm', parameter: 'fir' },
                { type: 'goog-remb' },
                { type: 'transport-cc' },
            ] as RtcpFeedback[],
        },
        {
            kind: 'video' as MediaKind,
            mimeType: 'video/H264',
            clockRate: 90000,
            parameters: {
                'packetization-mode': 1,
                'profile-level-id': '42e01f',
                'level-asymmetry-allowed': 1,
            },
            rtcpFeedback: [
                { type: 'nack' },
                { type: 'nack', parameter: 'pli' },
                { type: 'ccm', parameter: 'fir' },
                { type: 'goog-remb' },
                { type: 'transport-cc' },
            ] as RtcpFeedback[],
        },
    ] as RouterRtpCodecCapability[],

    // ✅ Full - Maximum compatibility
    full: mediaCodecs,
};

// Environment-based configuration selector
export const getMediaCodecs = (): RouterRtpCodecCapability[] => {
    const profile = process.env.MEDIASOUP_CODEC_PROFILE || 'balanced';

    switch (profile.toLowerCase()) {
        case 'minimal':
            return codecPresets.minimal;
        case 'full':
        case 'maximum':
            return codecPresets.full;
        case 'balanced':
        case 'production':
        default:
            return codecPresets.balanced;
    }
};

// Validation helper function
export const validateCodecConfiguration = (codecs: RouterRtpCodecCapability[]): boolean => {
    const payloadTypes = new Set<number>();

    for (const codec of codecs) {
        // Check required fields
        if (!codec.kind || !codec.mimeType || !codec.clockRate) {
            console.error('❌ Invalid codec: missing required fields', codec);
            return false;
        }

        // Check payload type uniqueness (if specified)
        if (codec.preferredPayloadType !== undefined) {
            if (payloadTypes.has(codec.preferredPayloadType)) {
                console.error('❌ Duplicate payload type:', codec.preferredPayloadType);
                return false;
            }
            payloadTypes.add(codec.preferredPayloadType);

            // Check payload type range (should be 96-127 for dynamic types)
            if (codec.preferredPayloadType < 0 || codec.preferredPayloadType > 127) {
                console.error('❌ Invalid payload type range:', codec.preferredPayloadType);
                return false;
            }
        }

        // Validate media kind
        if (codec.kind !== 'audio' && codec.kind !== 'video') {
            console.error('❌ Invalid media kind:', codec.kind);
            return false;
        }

        // Validate channels for audio
        if (codec.kind === 'audio' && codec.channels && codec.channels < 1) {
            console.error('❌ Invalid channel count for audio:', codec.channels);
            return false;
        }
    }

    console.log('✅ Codec configuration is valid');
    return true;
};

// Debug helper to log the selected configuration
export const logCodecConfiguration = (codecs: RouterRtpCodecCapability[]): void => {
    console.log('📊 MediaSoup Codec Configuration:');

    const audioCodecs = codecs.filter(c => c.kind === 'audio');
    const videoCodecs = codecs.filter(c => c.kind === 'video');

    console.log(`🎵 Audio codecs (${audioCodecs.length}):`);
    audioCodecs.forEach((codec, index) => {
        console.log(`  ${index + 1}. ${codec.mimeType} @ ${codec.clockRate}Hz ${codec.channels ? `(${codec.channels}ch)` : ''}`);
    });

    console.log(`🎥 Video codecs (${videoCodecs.length}):`);
    videoCodecs.forEach((codec, index) => {
        const profileInfo = codec.parameters?.['profile-level-id'] || codec.parameters?.['profile-id'] || '';
        console.log(`  ${index + 1}. ${codec.mimeType} ${profileInfo ? `(${profileInfo})` : ''}`);
    });

    // RTX will be handled automatically by MediaSoup
    console.log('🔄 RTX: Handled automatically by MediaSoup');
};

// Usage example and export
const selectedCodecs = getMediaCodecs();

// Validate the configuration
if (validateCodecConfiguration(selectedCodecs)) {
    logCodecConfiguration(selectedCodecs);
}

// ✅ This is what you should import in your server
export default selectedCodecs;

// 📝 USAGE EXAMPLE:
// 
// import mediaCodecs from './mediaCodecs';
// 
// const router = await worker.createRouter({ 
//     mediaCodecs 
// });
//
// OR with environment variable:
// 
// MEDIASOUP_CODEC_PROFILE=minimal npm start
// MEDIASOUP_CODEC_PROFILE=balanced npm start  
// MEDIASOUP_CODEC_PROFILE=full npm start