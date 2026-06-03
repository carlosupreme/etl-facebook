import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme/tokens'
import DashboardOverview from '../screens/DashboardOverview'
import WeaknessesHub from '../screens/WeaknessesHub'
import QueriesScreen from '../screens/QueriesScreen'
import KpiCatalogScreen from '../screens/KpiCatalogScreen'
import SettingsScreen from '../screens/SettingsScreen'
import FollowersScreen from '../screens/FollowersScreen'
import PermissionsScreen from '../screens/PermissionsScreen'

const Tab = createBottomTabNavigator()

export default function TabNavigator() {
  const { t } = useTranslation()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(0,0,0,0.08)',
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent.amber,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardOverview}
        options={{
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="WeaknessesTab"
        component={WeaknessesHub}
        options={{
          tabBarLabel: t('nav.weaknesses'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="QueriesTab"
        component={QueriesScreen}
        options={{
          tabBarLabel: t('nav.queries'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="KpiCatalogTab"
        component={KpiCatalogScreen}
        options={{
          tabBarLabel: t('nav.kpi_catalog'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="FollowersTab"
        component={FollowersScreen}
        options={{
          tabBarLabel: t('nav.followers'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PermissionsTab"
        component={PermissionsScreen}
        options={{
          tabBarLabel: t('nav.permissions'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('nav.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
