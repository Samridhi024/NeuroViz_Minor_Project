import 'bootstrap/dist/css/bootstrap.min.css';
import { useState } from 'react';
import { Bell, Activity, FileText } from 'lucide-react'; // Added icons

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TestResults from './components/TestResults';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  
  // NEW: State to toggle between Raw (Dirty) and Cleaned (Filtered) signals
  const [showCleaned, setShowCleaned] = useState(false);

  const handleAnalysisComplete = (newData) => {
    setData(newData);
    setActiveTab('dashboard');
    // Reset to Raw view initially so user sees the "Before" state first
    setShowCleaned(false);
  };

  return (
    <div className="container-fluid min-vh-100 bg-light">
      <div className="row min-vh-100 flex-nowrap">
        
        {/* SIDEBAR */}
        <div className="col-auto p-0 border-end" style={{ width: '280px', minWidth: '280px' }}>
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            disableResults={!data} 
          />
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="col p-0 d-flex flex-column h-100 overflow-hidden">
          
          {/* HEADER */}
          <header className="bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center sticky-top shadow-sm">
            <div>
              <h5 className="fw-bold mb-0 text-dark">Hello👋</h5>
              <small className="text-muted">
                {data ? "Patient analysis ready" : "Waiting for file upload"}
              </small>
            </div>
            
            <div className="d-flex align-items-center gap-4">
              
              {/* NEW: THE MAGIC TOGGLE BUTTON */}
              {/* Only visible when data is loaded and we are on the dashboard */}
              {data && activeTab === 'dashboard' && (
                <button
                  onClick={() => setShowCleaned(!showCleaned)}
                  className={`btn d-flex align-items-center gap-2 px-3 py-2 fw-bold transition-all ${
                    showCleaned 
                      ? "btn-outline-danger" 
                      : "btn-primary shadow-sm"
                  }`}
                  style={{ borderRadius: '10px' }}
                >
                  {showCleaned ? (
                    <>
                      <FileText size={18} />
                      Show Raw Input
                    </>
                  ) : (
                    <>
                      <Activity size={18} />
                      ✨ Clean Signal
                    </>
                  )}
                </button>
              )}

              {/* NOTIFICATION BELL */}
              <div className="position-relative cursor-pointer">
                <Bell size={20} className="text-secondary"/>
                <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"></span>
              </div>
              
              {/* USER PROFILE */}
              <div className="d-flex align-items-center gap-3 ps-3 border-start">
                <div className="text-end d-none d-md-block">
                    <div className="fw-bold small">Subject</div>
                    <div className="text-muted" style={{fontSize: '0.75rem'}}>Patient</div>
                </div>
                <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{width: 40, height: 40}}>SJ</div>
              </div>
            </div>
          </header>

          {/* CONTENT BODY */}
          <div className="flex-grow-1 p-4 overflow-auto scroll-smooth bg-light">
            <div className="container-fluid p-0" style={{maxWidth: '1600px'}}>
              
              {activeTab === 'dashboard' && (
                <Dashboard 
                  data={data}
                  onAnalysisComplete={handleAnalysisComplete}
                  showCleaned={showCleaned} // Pass the toggle state down!
                />
              )}

              {activeTab === 'results' && (
                <TestResults data={data} />
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

// import 'bootstrap/dist/css/bootstrap.min.css';
// import { useState } from 'react';
// import { Bell } from 'lucide-react';

// import Sidebar from './components/Sidebar';
// import Dashboard from './components/Dashboard';
// import TestResults from './components/TestResults';
// import './App.css';

// function App() {
//   const [activeTab, setActiveTab] = useState('dashboard');
//   const [data, setData] = useState(null);

//   const handleAnalysisComplete = (newData) => {
//     setData(newData);
//     setActiveTab('dashboard'); 
//   };

//   return (
//     <div className="container-fluid min-vh-100 bg-light">
//       <div className="row min-vh-100 flex-nowrap">
        
//         <div className="col-auto p-0 border-end" style={{ width: '280px', minWidth: '280px' }}>
//           <Sidebar 
//             activeTab={activeTab} 
//             setActiveTab={setActiveTab} 
//             disableResults={!data} 
//           />
//         </div>

//         <div className="col p-0 d-flex flex-column h-100 overflow-hidden">
          
//           <header className="bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
//             <div>
//               <h5 className="fw-bold mb-0 text-dark">Hello👋</h5>
//               <small className="text-muted">
//                 {data ? "Patient analysis ready" : "Waiting for file upload"}
//               </small>
//             </div>
            
//             <div className="d-flex align-items-center gap-4">
//               <div className="position-relative cursor-pointer">
//                 <Bell size={20} className="text-secondary"/>
//                 <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"></span>
//               </div>
//               <div className="d-flex align-items-center gap-3 ps-3 border-start">
//                 <div className="text-end d-none d-md-block">
//                     <div className="fw-bold small">Subject</div>
//                     <div className="text-muted" style={{fontSize: '0.75rem'}}>Patient</div>
//                 </div>
//                 <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{width: 40, height: 40}}>SJ</div>
//               </div>
//             </div>
//           </header>

//           <div className="flex-grow-1 p-4 overflow-auto scroll-smooth">
//             <div className="container-fluid p-0" style={{maxWidth: '1600px'}}>
              
//               {activeTab === 'dashboard' && (
//                 <Dashboard 
//                   data={data}
//                   onAnalysisComplete={handleAnalysisComplete}
//                 />
//               )}

//               {activeTab === 'results' && (
//                 <TestResults data={data} />
//               )}

//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;