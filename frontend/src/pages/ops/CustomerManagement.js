import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Users, Headphones, Bell, BarChart3 } from 'lucide-react';
import CustomersTab from './customers/CustomersTab';
import SupportTab from './customers/SupportTab';
import NotificationsTab from './customers/NotificationsTab';
import AnalyticsTab from './customers/AnalyticsTab';

export default function CustomerManagement() {
  const [subTab, setSubTab] = useState('customers');

  return (
    <div data-testid="customer-management">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-[#0F62FE]" />
        <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="customers" data-testid="subtab-customers">
            <Users className="h-4 w-4 mr-1.5" /> Customers
          </TabsTrigger>
          <TabsTrigger value="support" data-testid="subtab-support">
            <Headphones className="h-4 w-4 mr-1.5" /> Support
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="subtab-notifications">
            <Bell className="h-4 w-4 mr-1.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="subtab-analytics">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="support"><SupportTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

