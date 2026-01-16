export const defaultConfig = {
    ndi: {
        name: 'Amidash Signage',
        frameRate: 30,
    },
    display: {
        width: 3840,
        height: 2160,
        backgroundColor: '#1a1a2e',
        accentColor: '#023A2D',
        fontFamily: 'Inter, Arial, sans-serif',
        logoPath: undefined,
    },
    polling: {
        projects: 30000,
        revenue: 60000,
        schedule: 30000,
        purchaseOrders: 15000,
    },
    slides: [
        {
            type: 'active-projects',
            enabled: true,
            duration: 15000,
            title: 'Active Projects',
            maxItems: 15,
            showStatus: true,
            showDueDate: true,
            showSalesAmount: true,
        },
        {
            type: 'po-ticker',
            enabled: true,
            duration: 10000,
            title: 'Recent Purchase Orders',
            maxItems: 10,
            scrollSpeed: 2,
        },
        {
            type: 'revenue-dashboard',
            enabled: true,
            duration: 20000,
            title: 'Revenue Dashboard',
            showMonthlyGoals: true,
            showQuarterlyProgress: true,
            chartType: 'bar',
        },
        {
            type: 'team-schedule',
            enabled: true,
            duration: 15000,
            title: 'Team Schedule',
            daysToShow: 14,
            showWeekends: true,
        },
    ],
    transitions: {
        type: 'fade',
        duration: 500,
    },
    api: {
        port: 3001,
        host: '127.0.0.1',
    },
    staleData: {
        warningThresholdMs: 60000,
        indicatorPosition: 'bottom-right',
    },
};
//# sourceMappingURL=defaults.js.map