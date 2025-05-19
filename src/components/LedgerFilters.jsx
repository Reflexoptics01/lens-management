import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const LedgerFilters = ({ fromDate, setFromDate, toDate, setToDate, selectedEntity, setSelectedEntity, handleSearch, loading }) => {
  const [entities, setEntities] = useState([]);
  const [filteredEntities, setFilteredEntities] = useState([]);
  const [showEntityList, setShowEntityList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityIndex, setSelectedEntityIndex] = useState(-1);
  
  useEffect(() => {
    fetchEntities();
  }, []);
  
  // Effect to update searchTerm when selectedEntity prop changes from parent
  useEffect(() => {
    if (selectedEntity && selectedEntity.opticalName) {
      setSearchTerm(selectedEntity.opticalName);
    } else if (!selectedEntity) {
      // Optionally clear searchTerm if selectedEntity is explicitly cleared
      // setSearchTerm(''); 
    }
  }, [selectedEntity]); // Dependency array ensures this runs when selectedEntity changes
  
  const fetchEntities = async () => {
    try {
      const entitiesRef = collection(db, 'customers');
      const q = query(entitiesRef, orderBy('opticalName'));
      const snapshot = await getDocs(q);
      
      const entitiesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setEntities(entitiesList);
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  };
  
  const handleEntitySearch = (value) => {
    setSearchTerm(value);
    
    if (value.trim() === '') {
      setFilteredEntities([]);
      setShowEntityList(false);
      return;
    }
    
    const filtered = entities.filter(entity => 
      entity.opticalName.toLowerCase().includes(value.toLowerCase()) ||
      (entity.contactPerson && entity.contactPerson.toLowerCase().includes(value.toLowerCase()))
    );
    
    setFilteredEntities(filtered);
    setShowEntityList(true);
    setSelectedEntityIndex(-1); // Reset the selected index when search results change
  };
  
  const handleEntitySelect = (entity) => {
    setSelectedEntity(entity);
    setSearchTerm(entity.opticalName);
    setShowEntityList(false);
  };
  
  const handleKeyDown = (e) => {
    if (!showEntityList || filteredEntities.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedEntityIndex(prev => 
          prev < filteredEntities.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedEntityIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        if (selectedEntityIndex >= 0 && selectedEntityIndex < filteredEntities.length) {
          e.preventDefault();
          handleEntitySelect(filteredEntities[selectedEntityIndex]);
        }
        break;
      case 'Tab':
        if (selectedEntityIndex >= 0 && selectedEntityIndex < filteredEntities.length) {
          e.preventDefault();
          handleEntitySelect(filteredEntities[selectedEntityIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowEntityList(false);
        break;
      default:
        break;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-2 mb-2">
      <div className="flex flex-wrap items-end gap-2">
        {/* Date Range */}
        <div className="flex-none w-[160px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-md border-gray-300 border border-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1"
          />
        </div>
        
        <div className="flex-none w-[160px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-md border-gray-300 border border-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1"
          />
        </div>
        
        {/* Party Selection */}
        <div className="flex-1 min-w-[300px] max-w-[400px] relative">
          <label className="block text-xs font-medium text-gray-700 mb-1">Party</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              handleEntitySearch(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onClick={() => {
              if (searchTerm) {
                handleEntitySearch(searchTerm);
              }
            }}
            placeholder="Search party..."
            className="w-full rounded-md border-gray-300 border border-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1"
          />
          
          {showEntityList && filteredEntities.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-sm overflow-auto border border-gray-300">
              {filteredEntities.map((entity, idx) => (
                <div
                  key={entity.id}
                  onClick={() => handleEntitySelect(entity)}
                  onMouseEnter={() => setSelectedEntityIndex(idx)}
                  className={`cursor-pointer py-1 pl-3 pr-9 hover:bg-gray-100 ${
                    selectedEntityIndex === idx ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <span className="font-medium block truncate">{entity.opticalName}</span>
                  {entity.contactPerson && (
                    <span className="text-gray-500 block truncate text-xs">{entity.contactPerson}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading || !selectedEntity}
            className="bg-blue-600 text-white py-1 px-14 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 text-sm h-[32px] flex items-center"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Search
          </button>
          
          {/* Print Button */}
          <button 
            onClick={() => window.printLedger && window.printLedger()}
            disabled={!selectedEntity}
            className="flex items-center px-4 py-1 bg-gray-100 text-gray-800 rounded border border-gray-300 text-sm hover:bg-gray-200 h-[32px] disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          
          {/* Export Button */}
          <button 
            onClick={() => window.exportToExcel && window.exportToExcel()}
            disabled={!selectedEntity}
            className="flex items-center px-4 py-1 bg-green-100 text-green-800 rounded border border-green-300 text-sm hover:bg-green-200 h-[32px] disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          
          {/* WhatsApp Button */}
          <button 
            onClick={() => window.shareViaWhatsApp && window.shareViaWhatsApp()}
            disabled={!selectedEntity}
            className="flex items-center px-4 py-1 bg-green-600 text-white rounded border border-green-700 text-sm hover:bg-green-700 h-[32px] disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.288.131.332.202.043.72.043.433-.101.824z"/>
            </svg>
            Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default LedgerFilters; 