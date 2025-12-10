import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { CONFIG } from '../config/constants';

export default function GameScreen() {
  
  useEffect(() => {
    // Khóa màn hình ngang khi vào game
    async function lockOrientation() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    lockOrientation();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <WebView 
        source={{ uri: CONFIG.SERVER_URL }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        androidHardwareAccelerationDisabled={false}
        overScrollMode="never"
        scalesPageToFit={false}
        // Cho phép nội dung tràn qua vùng tai thỏ (notch)
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
