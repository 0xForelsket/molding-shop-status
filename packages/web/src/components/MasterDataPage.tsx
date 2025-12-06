import { AlertCircle, Calendar, CalendarDays, Clock, Cog, Database, Layers } from 'lucide-react';
import { useState } from 'react';
import { DowntimeReasonsTab } from './master-data/DowntimeReasonsTab';
import { MachinesTab } from './master-data/MachinesTab';
import { PlantCalendarTab } from './master-data/PlantCalendarTab';
import { ProductLinesTab } from './master-data/ProductLinesTab';
import { ShiftScheduleTab } from './master-data/ShiftScheduleTab';
import { ShiftsTab } from './master-data/ShiftsTab';
import { TabButton } from './ui/tab-button';

type Tab = 'shifts' | 'downtime' | 'productlines' | 'machines' | 'plantcalendar' | 'shiftschedule';

export function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>('shifts');

  return (
    <div className="flex-1 bg-slate-50 p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
              <Database className="w-6 h-6 text-white" />
            </div>
            Master Data
          </h1>
          <p className="text-slate-500 ml-[3.25rem]">
            Manage shifts, calendars, downtime reasons, and product lines
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-col gap-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <TabButton
              active={activeTab === 'shifts'}
              onClick={() => setActiveTab('shifts')}
              icon={<Clock className="w-4 h-4" />}
              label="Shifts & Breaks"
            />
            <TabButton
              active={activeTab === 'plantcalendar'}
              onClick={() => setActiveTab('plantcalendar')}
              icon={<Calendar className="w-4 h-4" />}
              label="Plant Calendar"
            />
            <TabButton
              active={activeTab === 'shiftschedule'}
              onClick={() => setActiveTab('shiftschedule')}
              icon={<CalendarDays className="w-4 h-4" />}
              label="Shift Schedule"
            />
            <TabButton
              active={activeTab === 'downtime'}
              onClick={() => setActiveTab('downtime')}
              icon={<AlertCircle className="w-4 h-4" />}
              label="Downtime Reasons"
            />
            <TabButton
              active={activeTab === 'productlines'}
              onClick={() => setActiveTab('productlines')}
              icon={<Layers className="w-4 h-4" />}
              label="Product Lines"
            />
            <TabButton
              active={activeTab === 'machines'}
              onClick={() => setActiveTab('machines')}
              icon={<Cog className="w-4 h-4" />}
              label="Machines"
            />
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
            {activeTab === 'shifts' && <ShiftsTab />}
            {activeTab === 'plantcalendar' && <PlantCalendarTab />}
            {activeTab === 'shiftschedule' && <ShiftScheduleTab />}
            {activeTab === 'downtime' && <DowntimeReasonsTab />}
            {activeTab === 'productlines' && <ProductLinesTab />}
            {activeTab === 'machines' && <MachinesTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
