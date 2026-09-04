import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { BloomTimelineScreen } from '../bloomTimeline/BloomTimelineScreen'
import { PlantDetailScreen } from '../registry/PlantDetailScreen'
import { RegistryScreen } from '../registry/RegistryScreen'
import { PlantingDetailScreen } from '../plantings/PlantingDetailScreen'
import { BaseMapSetupScreen } from '../property/BaseMapSetupScreen'
import { MapScreen } from '../property/MapScreen'
import { DashboardScreen } from '../screens/DashboardScreen'
import { LoadingScreen } from '../screens/LoadingScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { TagScanAmbiguousSpeciesScreen } from '../tagScan/TagScanAmbiguousSpeciesScreen'
import { TagScanCaptureScreen } from '../tagScan/TagScanCaptureScreen'
import { TagScanDuplicateOfferScreen } from '../tagScan/TagScanDuplicateOfferScreen'
import { TagScanMultipleReadingsScreen } from '../tagScan/TagScanMultipleReadingsScreen'
import { TagScanReviewScreen } from '../tagScan/TagScanReviewScreen'
import { PlantingTaskHistoryScreen } from '../tasks/PlantingTaskHistoryScreen'
import { TasksScreen } from '../tasks/TasksScreen'
import type { AuthStackParamList, MainStackParamList } from './types'

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const MainStack = createNativeStackNavigator<MainStackParamList>()

/**
 * Switches between the Auth and Main stacks based on AuthContext's status —
 * the RN equivalent of the web app's RequireAuth route guard, since there's
 * no URL to redirect: unmounting the Auth stack once authenticated is the
 * whole guard.
 */
export function RootNavigator() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (status === 'unauthenticated') {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      </AuthStack.Navigator>
    )
  }

  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Dashboard" component={DashboardScreen} />
      <MainStack.Screen name="Map" component={MapScreen} />
      <MainStack.Screen name="BaseMapSetup" component={BaseMapSetupScreen} />
      <MainStack.Screen name="Registry" component={RegistryScreen} />
      <MainStack.Screen name="PlantDetail" component={PlantDetailScreen} />
      <MainStack.Screen name="PlantingDetail" component={PlantingDetailScreen} />
      <MainStack.Screen name="BloomTimeline" component={BloomTimelineScreen} />
      <MainStack.Screen name="Tasks" component={TasksScreen} />
      <MainStack.Screen name="PlantingTaskHistory" component={PlantingTaskHistoryScreen} />
      <MainStack.Screen name="TagScanCapture" component={TagScanCaptureScreen} />
      <MainStack.Screen name="TagScanMultipleReadings" component={TagScanMultipleReadingsScreen} />
      <MainStack.Screen name="TagScanReview" component={TagScanReviewScreen} />
      <MainStack.Screen name="TagScanAmbiguousSpecies" component={TagScanAmbiguousSpeciesScreen} />
      <MainStack.Screen name="TagScanDuplicateOffer" component={TagScanDuplicateOfferScreen} />
    </MainStack.Navigator>
  )
}
