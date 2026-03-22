import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../contexts/AuthContext';

import AdminDashboard from '../screens/AdminDashboard';
import EditUserScreen from '../screens/EditUser';
import AgentDashboard from '../screens/AgentDashboard';
import CreateFormScreen from '../screens/CreateForm';

const AppStack = createStackNavigator();

export default function AppRoutes() {
  const { user } = useContext(AuthContext);

  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      {user?.role === 'ADMIN' ? (
        <>
          <AppStack.Screen name="AdminDashboard" component={AdminDashboard} />
          <AppStack.Screen name="EditUser" component={EditUserScreen} />
        </>
      ) : (
        <>
          <AppStack.Screen name="AgentDashboard" component={AgentDashboard} />
          <AppStack.Screen name="CreateForm" component={CreateFormScreen} />
        </>
      )}
    </AppStack.Navigator>
  );
}
