import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, Platform } from 'react-native'
import './src/i18n'
import { DbProvider } from './src/db/DbContext'
import { DbUploader } from './src/components/DbUploader'
import { GlobalLoadingBar } from './src/components/GlobalLoadingBar'
import DrawerNavigator from './src/navigation/DrawerNavigator'

const darkTheme = {
  dark: true as const,
  colors: {
    primary: '#E8954A',
    background: '#0B0D1A',
    card: 'rgba(255,255,255,0.04)',
    text: '#F0EDE8',
    border: 'rgba(255,255,255,0.08)',
    notification: '#E84A5A',
  },
  fonts: {
    regular: { fontFamily: 'System' as const, fontWeight: '400' as const },
    medium: { fontFamily: 'System' as const, fontWeight: '500' as const },
    bold: { fontFamily: 'System' as const, fontWeight: '700' as const },
    heavy: { fontFamily: 'System' as const, fontWeight: '800' as const },
  },
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DbProvider>
        <SafeAreaProvider>
          <View style={{ flex: 1 }}>
            {Platform.OS === 'web' && <DbUploader />}
            <NavigationContainer theme={darkTheme}>
              <DrawerNavigator />
            </NavigationContainer>
            <GlobalLoadingBar />
          </View>
        </SafeAreaProvider>
        <StatusBar style="light" />
      </DbProvider>
    </GestureHandlerRootView>
  )
}
