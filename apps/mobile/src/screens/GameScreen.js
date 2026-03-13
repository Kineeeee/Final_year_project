import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { CONFIG } from '../config/AppConfig';

const STATUS = {
    CONNECTING: 'connecting',
    READY: 'ready',
    ERROR: 'error',
};

export default function GameScreen() {
    const [status, setStatus] = useState(STATUS.CONNECTING);
    const [progress, setProgress] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const [chromeVisible, setChromeVisible] = useState(true);
    const [hintVisible, setHintVisible] = useState(false);

    const chromeOpacity = useRef(new Animated.Value(1)).current;
    const allowedOriginRef = useRef(null);

    if (!allowedOriginRef.current) {
        try {
            allowedOriginRef.current = new URL(CONFIG.SERVER_URL).origin;
        } catch {
            allowedOriginRef.current = null;
        }
    }

    useEffect(() => {
        // Khóa màn hình ngang để bám sát gameplay
        const lockOrientation = async () => {
            try {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            } catch (e) {
                console.warn('Không khóa được orientation', e);
            }
        };
        lockOrientation();

        return () => {
            if (ScreenOrientation.unlockAsync) {
                ScreenOrientation.unlockAsync().catch(() => {});
            }
        };
    }, []);

    useEffect(() => {
        Animated.timing(chromeOpacity, {
            toValue: chromeVisible ? 1 : 0,
            duration: 280,
            useNativeDriver: true,
        }).start();
    }, [chromeVisible, chromeOpacity]);

    useEffect(() => {
        if (status === STATUS.READY) {
            setHintVisible(true);
            const hideChrome = setTimeout(() => setChromeVisible(false), 3200);
            const hideHint = setTimeout(() => setHintVisible(false), 5200);
            return () => {
                clearTimeout(hideChrome);
                clearTimeout(hideHint);
            };
        }

        setChromeVisible(true);
        setHintVisible(false);
    }, [status]);

    const statusLabel = useMemo(() => {
        switch (status) {
            case STATUS.READY:
                return 'Trực tuyến';
            case STATUS.ERROR:
                return 'Mất kết nối';
            default:
                return 'Đang kết nối...';
        }
    }, [status]);

    const statusStyle = useMemo(() => {
        switch (status) {
            case STATUS.READY:
                return { backgroundColor: 'rgba(52, 211, 153, 0.18)', color: '#34d399' };
            case STATUS.ERROR:
                return { backgroundColor: 'rgba(248, 113, 113, 0.18)', color: '#f87171' };
            default:
                return { backgroundColor: 'rgba(96, 165, 250, 0.18)', color: '#93c5fd' };
        }
    }, [status]);

    const handleReload = () => {
        setStatus(STATUS.CONNECTING);
        setProgress(0);
        setReloadKey((k) => k + 1);
    };

    const openInBrowser = async () => {
        try {
            await Linking.openURL(CONFIG.SERVER_URL);
        } catch (e) {
            console.warn('Không mở được link', e);
        }
    };

    const progressWidth = `${Math.max(progress, 0.05) * 100}%`;

    const handleShouldStartLoad = (request) => {
        const nextUrl = request?.url;
        if (!nextUrl) return false;

        if (nextUrl.startsWith('about:blank')) return true;

        try {
            const nextOrigin = new URL(nextUrl).origin;
            if (!allowedOriginRef.current || nextOrigin === allowedOriginRef.current) {
                return true;
            }
        } catch {
            return false;
        }

        Linking.openURL(nextUrl).catch((e) => {
            console.warn('Không mở được link ngoài WebView', e);
        });
        return false;
    };

    return (
        <View style={styles.root}>
            <StatusBar style="light" hidden />

            {/* Light auras for a non-flat background */}
            <View style={styles.bgLayer} pointerEvents="none">
                <View style={[styles.glow, styles.glowA]} />
                <View style={[styles.glow, styles.glowB]} />
            </View>

            <WebView
                key={reloadKey}
                source={{ uri: CONFIG.SERVER_URL }}
                style={styles.webview}
                scrollEnabled={false}
                bounces={false}
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
                androidHardwareAccelerationDisabled={false}
                overScrollMode="never"
                scalesPageToFit={false}
                contentInsetAdjustmentBehavior="never"
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                onLoadStart={() => setStatus(STATUS.CONNECTING)}
                onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress ?? 0)}
                onLoadEnd={() => setStatus(STATUS.READY)}
                onError={() => setStatus(STATUS.ERROR)}
                onHttpError={() => setStatus(STATUS.ERROR)}
            />

            <View style={styles.overlay} pointerEvents={status === STATUS.READY ? 'box-none' : 'auto'}>
                <Animated.View style={[styles.chrome, { opacity: chromeOpacity }]} pointerEvents="auto">
                    <SafeAreaView>
                        <View style={styles.topRow}>
                            <View style={styles.brand}>
                                <Text style={styles.brandTitle}>Snake Arena</Text>
                                <Text style={styles.brandSubtitle}>Mobile shell · Landscape</Text>
                            </View>
                            <View style={styles.topActions}>
                                <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor }]}>
                                    <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusLabel}</Text>
                                </View>
                                <TouchableOpacity style={styles.reloadBtn} onPress={handleReload} activeOpacity={0.85}>
                                    <Text style={styles.reloadText}>Tải lại</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.urlRow}>
                            <Text style={styles.urlLabel}>Server</Text>
                            <Text style={styles.urlValue} numberOfLines={1}>
                                {CONFIG.SERVER_URL}
                            </Text>
                        </View>

                        <View style={styles.progressTrack}>
                            <View style={[styles.progressBar, { width: progressWidth }]} />
                        </View>
                    </SafeAreaView>
                </Animated.View>

                {status === STATUS.CONNECTING && (
                    <View style={styles.centerCard}>
                        <ActivityIndicator size="large" color="#7dd3fc" />
                        <Text style={styles.cardTitle}>Đang nạp game</Text>
                        <Text style={styles.cardBody}>Nếu server vừa khởi động, có thể mất 5-10 giây.</Text>
                    </View>
                )}

                {status === STATUS.ERROR && (
                    <View style={[styles.centerCard, styles.errorCard]}>
                        <Text style={styles.cardTitle}>Không truy cập được server</Text>
                        <Text style={styles.cardBody}>Kiểm tra kết nối Wi-Fi / 4G hoặc khởi động lại server.</Text>
                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.actionGhost} onPress={openInBrowser} activeOpacity={0.9}>
                                <Text style={styles.actionGhostText}>Mở trong trình duyệt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionPrimary} onPress={handleReload} activeOpacity={0.95}>
                                <Text style={styles.actionPrimaryText}>Thử lại</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {hintVisible && status === STATUS.READY && (
                    <View style={styles.hintCard} pointerEvents="none">
                        <Text style={styles.hintTitle}>Mẹo điều khiển</Text>
                        <Text style={styles.hintBody}>
                            Kéo joystick trái để xoay rắn, giữ nút đỏ để tăng tốc. Giữ máy nằm ngang để che full màn hình.
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#050915',
    },
    bgLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    glow: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 280,
        opacity: 0.35,
        transform: [{ rotate: '12deg' }],
    },
    glowA: {
        top: -60,
        right: -60,
        backgroundColor: 'rgba(56, 189, 248, 0.45)',
    },
    glowB: {
        bottom: -80,
        left: -60,
        backgroundColor: 'rgba(16, 185, 129, 0.38)',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2,
    },
    chrome: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brand: {
        maxWidth: '55%',
    },
    brandTitle: {
        color: '#e2e8f0',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    brandSubtitle: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
    },
    topActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusPill: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        marginRight: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    reloadBtn: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    reloadText: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    urlRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    urlLabel: {
        color: '#94a3b8',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginRight: 6,
    },
    urlValue: {
        flex: 1,
        color: '#e0f2fe',
        fontSize: 12,
    },
    progressTrack: {
        marginTop: 12,
        height: 5,
        borderRadius: 5,
        backgroundColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#38bdf8',
        borderRadius: 5,
    },
    centerCard: {
        position: 'absolute',
        left: 18,
        right: 18,
        top: '38%',
        padding: 18,
        borderRadius: 18,
        backgroundColor: 'rgba(7, 11, 22, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 24,
        elevation: 10,
    },
    errorCard: {
        borderColor: 'rgba(248, 113, 113, 0.4)',
    },
    cardTitle: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: '800',
        color: '#e2e8f0',
        letterSpacing: 0.4,
        textAlign: 'center',
    },
    cardBody: {
        marginTop: 8,
        fontSize: 14,
        color: '#cbd5e1',
        textAlign: 'center',
        lineHeight: 20,
    },
    cardActions: {
        marginTop: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    actionGhost: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.35)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        marginRight: 10,
    },
    actionGhostText: {
        color: '#cbd5e1',
        fontWeight: '700',
    },
    actionPrimary: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#22d3ee',
        alignItems: 'center',
        shadowColor: '#22d3ee',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 16,
        elevation: 6,
    },
    actionPrimaryText: {
        color: '#0b1224',
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    hintCard: {
        position: 'absolute',
        bottom: 22,
        left: 16,
        right: 16,
        padding: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(9, 14, 26, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    hintTitle: {
        color: '#7dd3fc',
        fontWeight: '800',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    hintBody: {
        marginTop: 6,
        color: '#e2e8f0',
        fontSize: 13,
        lineHeight: 18,
    },
});
