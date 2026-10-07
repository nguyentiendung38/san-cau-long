import { Outlet } from 'react-router-dom';
import { PortalBottomNav } from './PortalBottomNav';
import { PortalHeader } from './PortalHeader';

export default function PortalLayout() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <PortalHeader />
            <div className="flex-1 pb-24">
                <Outlet />
            </div>
            <PortalBottomNav />
        </div>
    );
}
