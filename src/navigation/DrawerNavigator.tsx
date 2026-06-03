import { createDrawerNavigator } from '@react-navigation/drawer'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '../theme/tokens'
import TabNavigator from './TabNavigator'
import KpiCatalogScreen from '../screens/KpiCatalogScreen'
import EngagementScreen from '../screens/EngagementScreen'
import ContentScreen from '../screens/ContentScreen'
import AdvertisingScreen from '../screens/AdvertisingScreen'
import ActivityScreen from '../screens/ActivityScreen'
import FollowersScreen from '../screens/FollowersScreen'
import PermissionsScreen from '../screens/PermissionsScreen'

const Drawer = createDrawerNavigator()

function DrawerContent() {
  const { t } = useTranslation()
  return (
    <View style={drawerStyles.container}>
      <View style={drawerStyles.header}>
        <Text style={drawerStyles.title}>FB Studio</Text>
        <Text style={drawerStyles.sub}>Manager Dashboard</Text>
      </View>
    </View>
  )
}

export default function DrawerNavigator() {
  const { t } = useTranslation()

  return (
    <Drawer.Navigator
      drawerContent={() => <DrawerContent />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.space.bg,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.glass.cardBorder,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        drawerStyle: {
          backgroundColor: colors.space.bg,
          borderRightWidth: 1,
          borderRightColor: colors.glass.cardBorder,
          width: 260,
        },
        drawerActiveTintColor: colors.accent.amber,
        drawerInactiveTintColor: colors.text.secondary,
        drawerLabelStyle: { fontSize: 14, fontWeight: '500' },
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{
          title: t('nav.dashboard'),
          drawerIcon: ({ color }) => <Ionicons name="grid-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="KpiCatalog"
        component={KpiCatalogScreen}
        options={{
          title: t('nav.kpi_catalog'),
          drawerIcon: ({ color }) => <Ionicons name="analytics-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Engagement"
        component={EngagementScreen}
        options={{
          title: t('nav.engagement'),
          drawerIcon: ({ color }) => <Ionicons name="heart-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Content"
        component={ContentScreen}
        options={{
          title: t('nav.content'),
          drawerIcon: ({ color }) => <Ionicons name="document-text-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Advertising"
        component={AdvertisingScreen}
        options={{
          title: t('nav.advertising'),
          drawerIcon: ({ color }) => <Ionicons name="trending-up-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          title: t('nav.activity'),
          drawerIcon: ({ color }) => <Ionicons name="people-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Followers"
        component={FollowersScreen}
        options={{
          title: t('nav.followers'),
          drawerIcon: ({ color }) => <Ionicons name="people-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Permissions"
        component={PermissionsScreen}
        options={{
          title: t('nav.permissions'),
          drawerIcon: ({ color }) => <Ionicons name="shield-checkmark-outline" size={20} color={color} />,
        }}
      />
    </Drawer.Navigator>
  )
}

const drawerStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.glass.cardBorder,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.accent.amber },
  sub: { ...typography.small, marginTop: spacing.xs },
})
