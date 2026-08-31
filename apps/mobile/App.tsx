import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { useAuthDeepLinkHandler } from './src/auth/useAuthDeepLinkHandler';
import { supabase } from './src/lib/supabaseClient';
import { RootNavigator } from './src/navigation/RootNavigator';
import { asPlantsDbClient } from './src/plants/plantsRepository';
import { PlantsRepositoryProvider } from './src/plants/PlantsRepositoryContext';
import { asPlantingsDbClient } from './src/plantings/plantingsRepository';
import { PlantingsRepositoryProvider } from './src/plantings/PlantingsRepositoryContext';
import { asBedsDbClient } from './src/property/bedsRepository';
import { BedsRepositoryProvider } from './src/property/BedsRepositoryContext';
import { asPropertiesDbClient } from './src/property/propertiesRepository';
import { PropertiesRepositoryProvider } from './src/property/PropertiesRepositoryContext';
import { asTagScanDbClient } from './src/tagScan/tagScanRepository';
import { TagScanRepositoryProvider } from './src/tagScan/TagScanRepositoryContext';

function AppShell() {
  useAuthDeepLinkHandler(supabase);

  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider client={supabase}>
        <TagScanRepositoryProvider client={asTagScanDbClient(supabase)}>
          <PropertiesRepositoryProvider client={asPropertiesDbClient(supabase)}>
            <BedsRepositoryProvider client={asBedsDbClient(supabase)}>
              <PlantingsRepositoryProvider client={asPlantingsDbClient(supabase)}>
                <PlantsRepositoryProvider client={asPlantsDbClient(supabase)}>
                  <AppShell />
                </PlantsRepositoryProvider>
              </PlantingsRepositoryProvider>
            </BedsRepositoryProvider>
          </PropertiesRepositoryProvider>
        </TagScanRepositoryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
