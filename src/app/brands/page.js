'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import DottedBackground from '@/components/DottedBackground';
import PlatformBadge from '@/components/PlatformBadge';
import Image from 'next/image';
import { Search, RefreshCw, Trash } from 'lucide-react';

// simple local chips input component
function Chips({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim().toLowerCase(); // Normalize to lowercase
    if (!t) return;
    // Case-insensitive check to prevent duplicates
    const normalizedValue = (value || []).map(v => String(v).toLowerCase().trim());
    if (!normalizedValue.includes(t)) {
      const newValue = [...(value || []), t];
      console.log('[Chips] Adding email:', t);
      console.log('[Chips] Current value:', value);
      console.log('[Chips] New value will be:', newValue);
      onChange(newValue);
      console.log('[Chips] onChange called with:', newValue);
    } else {
      // Email already exists, show feedback
      alert('This email is already in the list');
    }
    setInput('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 border border-gray-700">
            {v}
            <button type="button" onClick={()=>onChange(value.filter(x=>x!==v))} className="text-gray-400 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e)=>setInput(e.target.value)}
        onKeyDown={(e)=>{ if (e.key==='Enter'){ e.preventDefault(); add(); } }}
        placeholder={placeholder}
        className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm placeholder-gray-400"
      />
    </div>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showConfigureForm, setShowConfigureForm] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Create brand form state
  const [newBrand, setNewBrand] = useState({
    brandName: '',
    description: '',
    frequency: '30m',
    avatarUrl: '',
    country: '',
    aiFriendlyName: ''
  });
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [ticketCreation, setTicketCreation] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState([]); // simple chips input (strings)
  const [guidelines, setGuidelines] = useState('');

  // Configure brand form state
  const [configData, setConfigData] = useState({
    keywords: '',
    frequency: '30m',
    avatarUrl: '',
    platforms: {
      twitter: false,
      youtube: false,
      reddit: false
    },
    aiFriendlyName: '',
    description: '',
    country: '',
    brandColor: '#4f46e5',
    ticketCreation: false,
    users: []
  });

  useEffect(() => {
    // Get current user info
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      }
    } catch (e) {
      console.error('Failed to get user from localStorage:', e);
    }
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      // Get user info from localStorage or cookie
      let user = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) user = JSON.parse(userStr);
      } catch (e) {}

      // If user is admin, try to get all brands; fallback to user's assigned brands if access denied
      let data;
      if (user?.role === 'admin') {
        try {
          // Add cache-busting parameter to ensure fresh data
          const timestamp = Date.now();
          data = await api.brands.getAll();
          console.log(`[BrandsPage] Fetched brands at ${new Date(timestamp).toISOString()}`);
        } catch (adminErr) {
          // If admin access fails, fallback to user-specific brands
          console.warn('Admin access failed, falling back to user brands:', adminErr.message);
          if (user?.email) {
            data = await api.brands.getByUser(user.email);
          } else {
            throw new Error('User not authenticated');
          }
        }
      } else if (user?.email) {
        // Add cache-busting parameter to ensure fresh data
        const timestamp = Date.now();
        data = await api.brands.getByUser(user.email);
        console.log(`[BrandsPage] Fetched user brands at ${new Date(timestamp).toISOString()}`);
      } else {
        // Fallback: try to get user email from token or redirect to login
        throw new Error('User not authenticated. Please login again.');
      }
      
      console.log('[BrandsPage] Fetched brands data:', data);
      console.log('[BrandsPage] Brands array:', data.brands);
      // Debug: log assignedUsers for each brand
      if (data.brands && Array.isArray(data.brands)) {
        data.brands.forEach(b => {
          console.log(`[BrandsPage] Brand "${b.brandName}" has assignedUsers:`, b.assignedUsers);
        });
      }
      const brandsList = data.brands || [];
      console.log('[BrandsPage] Setting brands:', brandsList);
      console.log('[BrandsPage] Brands with assignedUsers:', brandsList.map(b => ({
        brandName: b.brandName,
        assignedUsers: b.assignedUsers,
        assignedUsersType: typeof b.assignedUsers,
        assignedUsersIsArray: Array.isArray(b.assignedUsers),
        assignedUsersValue: JSON.stringify(b.assignedUsers),
        allKeys: Object.keys(b)
      })));
      
      // Ensure assignedUsers is always an array
      const normalizedBrands = brandsList.map(b => ({
        ...b,
        assignedUsers: Array.isArray(b.assignedUsers) 
          ? b.assignedUsers 
          : (b.users ? (Array.isArray(b.users) ? b.users : []) : [])
      }));
      
      console.log('[BrandsPage] Normalized brands:', normalizedBrands.map(b => ({
        brandName: b.brandName,
        assignedUsers: b.assignedUsers
      })));
      
      setBrands(normalizedBrands);
      console.log('[BrandsPage] brands state set to:', normalizedBrands.map(b => ({ brandName: b.brandName, assignedUsers: b.assignedUsers })));
      setError(null);
      
      // If configure form is open, refresh the configData with updated brand data
      if (showConfigureForm && brandsList.length > 0) {
        const updatedBrand = brandsList.find(b => b.brandName === showConfigureForm);
        if (updatedBrand) {
          const assignedUsersList = updatedBrand.assignedUsers || [];
          const usersArray = Array.isArray(assignedUsersList) 
            ? assignedUsersList.map(u => (typeof u === 'string' ? u : (u?.email || ''))).filter(Boolean)
            : [];
          console.log('[BrandsPage] Updating configData.users for open form:', usersArray);
          setConfigData(prev => ({
            ...prev,
            users: usersArray
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
      setError(err.message);
      setActionMessage('');
    } finally {
      setLoading(false);
    }
  };

  // Derived filtered list by brand name or allocated user fields when present
  const visibleBrands = (brands || []).filter((brand) => {
    const q = searchText.trim().toLowerCase();
    if (!q) return true;

    const collectUserText = (b) => {
      // Get assigned users (emails) from brand
      const possible = b.assignedUsers || b.users || b.members || b.user || b.owner || [];
      if (Array.isArray(possible)) {
        return possible
          .map((u) => (typeof u === 'string' ? u : (u?.email || '')))
          .filter(Boolean)
          .join(' ');
      }
      if (possible && typeof possible === 'object') {
        return possible.email || '';
      }
      return typeof possible === 'string' ? possible : '';
    };

    const haystack = [
      brand.brandName,
      brand.description,
      collectUserText(brand)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  const handleCreateBrand = async (e) => {
    e.preventDefault();
    try {
      // Create brand with assigned users if provided
      const brandData = {
        ...newBrand,
        assignedUsers: assignedUsers.length > 0 ? assignedUsers : []
      };
      await api.brands.create(brandData);
      
      // If users were provided, also assign them (in case create doesn't handle it)
      if (assignedUsers.length > 0) {
        try {
          await api.brands.assignUsers(newBrand.brandName, assignedUsers);
        } catch (assignErr) {
          console.warn('Brand created but user assignment failed:', assignErr);
        }
      }
      
      setNewBrand({ brandName: '', description: '', frequency: '30m', avatarUrl: '', country: '', aiFriendlyName: '' });
      setAssignedUsers([]);
      setShowCreateForm(false);
      fetchBrands();
      alert('✅ Brand created successfully!');
    } catch (err) {
      console.error('Brand creation error:', err);
      alert('Failed to create brand: ' + err.message);
    }
  };

  const handleDeleteBrand = async (brandName) => {
    if (!brandName) return;
    if (!confirm(`Permanently delete brand "${brandName}"? This action cannot be undone.`)) return;
    try {
      setActionMessage('Deleting brand…');
      const res = await api.brands.delete(brandName);
      console.log('[BrandsPage] Delete API response:', res);
      if (!res?.success) {
        throw new Error(res?.message || 'Delete failed');
      }
      setBrands((prev) =>
        prev.filter((b) => b.brandName?.toLowerCase() !== brandName.toLowerCase())
      );
      setShowConfigureForm(null);
      setActionMessage(`✅ Brand "${brandName}" deleted successfully.`);
    } catch (err) {
      console.error('[BrandsPage] Delete failed:', err);
      alert('Delete failed: ' + err.message);
      setActionMessage('');
    } finally {
      try {
        await fetchBrands();
      } catch (refetchErr) {
        console.error('[BrandsPage] Refetch after delete failed:', refetchErr);
      }
    }
  };

  const handleConfigureBrand = async (e, brandName) => {
    e.preventDefault();
    try {
      // Use the exact brand name from showConfigureForm (which is set from brand.brandName)
      const exactBrandName = showConfigureForm || brandName;
      console.log(`[BrandsPage] handleConfigureBrand called with brandName: "${brandName}"`);
      console.log(`[BrandsPage] showConfigureForm (exact brand name): "${exactBrandName}"`);
      
      const selectedPlatforms = Object.keys(configData.platforms).filter(
        p => configData.platforms[p]
      );
      const keywords = configData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k);

      // Configure brand (keywords, platforms, etc.) - use exact brand name
      await api.brands.configure({
        brandName: exactBrandName,
        keywords,
        platforms: selectedPlatforms,
        frequency: configData.frequency,
        avatarUrl: configData.avatarUrl || undefined
      });

      // Always update user assignments if admin (even if empty array to remove users)
      if (currentUser?.role === 'admin') {
        const usersToAssign = Array.isArray(configData.users) 
          ? configData.users.map(u => String(u).trim().toLowerCase()).filter(Boolean)
          : [];
        
        console.log(`[BrandsPage] Configuring brand "${exactBrandName}"`);
        console.log(`[BrandsPage] Current configData.users:`, configData.users);
        console.log(`[BrandsPage] Normalized users to assign:`, usersToAssign);
        console.log(`[BrandsPage] Will call assignUsers with brandName: "${exactBrandName}", users:`, usersToAssign);
        
        if (usersToAssign.length === 0) {
          console.warn(`[BrandsPage] ⚠️ WARNING: usersToAssign is empty! configData.users was:`, configData.users);
        }
        
        try {
          const assignResult = await api.brands.assignUsers(exactBrandName, usersToAssign);
          console.log('[BrandsPage] ✅ User assignment SUCCESS:', assignResult);
          console.log('[BrandsPage] Assigned users from response (brand.assignedUsers):', assignResult?.brand?.assignedUsers);
          console.log('[BrandsPage] Assigned users from response (direct):', assignResult?.assignedUsers);
          
          if (!assignResult?.success) {
            throw new Error(assignResult?.message || 'Assignment failed');
          }
          
          // Force a small delay to ensure backend has saved
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (assignErr) {
          console.error('[BrandsPage] ❌ Failed to assign users during configure:', assignErr);
          console.error('[BrandsPage] Error details:', {
            message: assignErr.message,
            stack: assignErr.stack,
            response: assignErr.response
          });
          // Don't continue - show error and stop
          alert(`❌ Failed to assign users: ${assignErr.message}`);
          return; // Stop here if assignment fails
        }
      } else {
        console.log(`[BrandsPage] User is not admin, skipping user assignment. Role:`, currentUser?.role);
      }

      // Refresh brands list to get updated data - do this BEFORE closing the form
      console.log('[BrandsPage] Refreshing brands list after configuration...');
      
      // Manually fetch and verify the update
      let user = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) user = JSON.parse(userStr);
      } catch (e) {}
      
      let freshData;
      if (user?.role === 'admin') {
        freshData = await api.brands.getAll();
      } else if (user?.email) {
        freshData = await api.brands.getByUser(user.email);
      }
      
      // Use exact brand name for verification
      const updatedBrand = freshData?.brands?.find(b => 
        b.brandName?.toLowerCase() === exactBrandName?.toLowerCase()
      );
      if (updatedBrand) {
        console.log(`[BrandsPage] ✅ Verified updated brand "${exactBrandName}":`, {
          assignedUsers: updatedBrand.assignedUsers,
          count: updatedBrand.assignedUsers?.length || 0,
          brandNameInDB: updatedBrand.brandName
        });
      } else {
        console.warn(`[BrandsPage] ⚠️ Could not find updated brand "${exactBrandName}" in fresh data`);
        console.warn(`[BrandsPage] Available brands:`, freshData?.brands?.map(b => b.brandName));
      }
      
      // Now call fetchBrands to update the state
      await fetchBrands();
      
      setShowConfigureForm(null);
      setConfigData({ keywords: '', frequency: '30m', avatarUrl: '', platforms: { twitter: false, youtube: false, reddit: false }, users: [] });
      alert('✅ Brand configured successfully!');
    } catch (err) {
      console.error('[BrandsPage] Failed to configure brand:', err);
      alert('Failed to configure brand: ' + err.message);
    }
  };

  // Separate function to assign users to a brand (can also remove users by passing empty array)
  const handleAssignUsers = async (brandName, users) => {
    try {
      // Normalize all emails to lowercase before sending
      const usersToAssign = Array.isArray(users) 
        ? users.map(u => String(u).trim().toLowerCase()).filter(Boolean)
        : [];
      console.log(`[BrandsPage] Updating user assignments for brand "${brandName}":`, usersToAssign);
      const result = await api.brands.assignUsers(brandName, usersToAssign);
      console.log('[BrandsPage] Assignment result:', result);
      console.log('[BrandsPage] Assigned users from response:', result?.brand?.assignedUsers);
      await fetchBrands(); // Wait for fetch to complete to show updated list
      if (usersToAssign.length === 0) {
        alert('✅ All users removed from brand successfully!');
      } else {
        alert('✅ Users assigned successfully!');
      }
    } catch (err) {
      console.error('[BrandsPage] Failed to assign users:', err);
      alert('Failed to update user assignments: ' + err.message);
    }
  };

  const openConfigure = (brand) => {
    const mappedPlatforms = {
      youtube: brand.platforms?.includes('youtube') || false,
      twitter: brand.platforms?.includes('twitter') || false,
      reddit: brand.platforms?.includes('reddit') || false,
    };
    
    // Get assigned users (emails) from brand (check both assignedUsers and users fields)
    const assignedUsersList = brand.assignedUsers || brand.users || [];
    const usersArray = Array.isArray(assignedUsersList) 
      ? assignedUsersList.map(u => (typeof u === 'string' ? u : (u?.email || ''))).filter(Boolean)
      : [];
    
    setConfigData({
      keywords: (brand.keywords || []).join(', '),
      frequency: brand.frequency || '30m',
      avatarUrl: brand.avatarUrl || '',
      platforms: mappedPlatforms,
      aiFriendlyName: brand.aiFriendlyName || brand.brandName || '',
      description: brand.description || '',
      country: brand.country || '',
      brandColor: brand.brandColor || '#4f46e5',
      ticketCreation: !!brand.ticketCreation,
      users: usersArray
    });
    setShowConfigureForm(brand.brandName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <DottedBackground />
        <div className="relative z-10">Loading brands...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 relative">
      <DottedBackground />
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Edit Brand - Fullscreen overlay like Create */}
        {showConfigureForm && (
          <div className="fixed inset-0 z-50 p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowConfigureForm(null)} />
            <div className="relative z-10 w-[96vw] max-w-6xl mx-auto bg-black border border-white/10 rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Edit Brand — {showConfigureForm}</h2>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowConfigureForm(null)} className="bg-gray-800 hover:bg-gray-700 h-9 px-3 text-sm">Close</Button>
                </div>
              </div>
              <form onSubmit={(e)=>handleConfigureBrand(e, showConfigureForm)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden">
                        {configData.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={configData.avatarUrl} alt={showConfigureForm} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-sm font-semibold">{(showConfigureForm || 'B').slice(0,1).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 inline-block">Upload Brand Logo</Label>
                        <input type="file" accept="image/*" onChange={(e)=>{
                          const file=e.target.files&&e.target.files[0];
                          if(!file) return; if(file.size>1024*1024){alert('Please choose an image under 1MB.');return;}
                          const reader=new FileReader(); reader.onload=()=>setConfigData({...configData, avatarUrl:String(reader.result)}); reader.readAsDataURL(file);
                        }} className="block text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Country</Label>
                      <Input value={configData.country} onChange={(e)=>setConfigData({...configData, country:e.target.value})} className="bg-gray-800 border-gray-700 text-white h-11 px-4 text-sm rounded-lg" placeholder="India" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Select Brand Color</Label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={configData.brandColor} onChange={(e)=>setConfigData({...configData, brandColor:e.target.value})} className="h-10 w-10 p-0 border border-gray-700 rounded" />
                        <input value={configData.brandColor} onChange={(e)=>setConfigData({...configData, brandColor:e.target.value})} className="bg-gray-800 border border-gray-700 text-white h-10 px-3 text-sm rounded-lg w-28" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Keywords (comma-separated)</Label>
                      <Input value={configData.keywords} onChange={(e)=>setConfigData({...configData, keywords:e.target.value})} className="bg-gray-800 border-gray-700 text-white h-11 px-4 text-sm rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Monitoring Frequency</Label>
                      <select value={configData.frequency} onChange={(e)=>setConfigData({...configData, frequency:e.target.value})} className="w-full h-11 px-4 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                        <option value="5m">Every 5 Minutes</option>
                        <option value="30m">Every 30 Minutes (Default)</option>
                        <option value="1h">Every 1 Hour</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Ticket Creation</Label>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={()=>setConfigData({...configData, ticketCreation: !configData.ticketCreation})} className={`w-12 h-6 rounded-full relative ${configData.ticketCreation?'bg-white':'bg-gray-700'}`}>
                          <span className={`absolute top-0.5 ${configData.ticketCreation?'left-6':'left-0.5'} transition-all w-5 h-5 rounded-full bg-white`} />
                        </button>
                        <span className="text-xs text-gray-400">Enable ticket creation for this brand.</span>
                      </div>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">AI Friendly Name</Label>
                      <div className="flex items-center gap-2">
                        <Input value={configData.aiFriendlyName} onChange={(e)=>setConfigData({...configData, aiFriendlyName:e.target.value})} className="flex-1 bg-gray-800 border-gray-700 text-white h-11 px-4 text-sm rounded-lg" />
                        <Button type="button" onClick={()=> setConfigData({...configData, description: `${configData.aiFriendlyName || showConfigureForm} is a brand.`})} className="bg-fuchsia-600 hover:bg-fuchsia-700 h-10 px-3 text-sm">Generate Description</Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Brand Description</Label>
                      <div className="relative">
                        <textarea value={configData.description} onChange={(e)=>setConfigData({...configData, description:e.target.value})} rows={6} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-3" />
                        <span className="absolute right-2 bottom-2 text-xs text-gray-400">{(configData.description||'').length}/200</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Platforms</Label>
                      <div className="flex gap-3 flex-wrap">
                        {['youtube','twitter','reddit'].map((platform)=>{
                          const map={youtube:{icon:'/youtube-logo.svg',name:'YouTube',w:32,h:32},twitter:{icon:'/x-logo.svg',name:'X (Twitter)',w:28,h:28},reddit:{icon:'/reddit-logo.svg',name:'Reddit',w:32,h:32}};
                          const cfg=map[platform]; const isSel=configData.platforms[platform];
                          return (
                            <button key={platform} type="button" onClick={()=>setConfigData({...configData, platforms:{...configData.platforms, [platform]: !configData.platforms[platform]}})} className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[112px] ${isSel?'bg-white/10 border-white shadow-lg':'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
                              <Image src={cfg.icon} alt={cfg.name} width={cfg.w} height={cfg.h} />
                              <span className={`text-xs font-semibold ${isSel?'text-white':'text-gray-400'}`}>{cfg.name}</span>
                              {isSel && <span className="text-xs text-white">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {currentUser?.role === 'admin' && (
                      <div>
                        <Label className="text-sm mb-1.5 inline-block">Assign Users (by Email)</Label>
                        <Chips 
                          value={configData.users || []} 
                          onChange={(v) => {
                            console.log('[BrandsPage] Chips onChange called with:', v);
                            console.log('[BrandsPage] Current configData.users:', configData.users);
                            setConfigData({...configData, users: v});
                            console.log('[BrandsPage] Updated configData.users to:', v);
                          }} 
                          placeholder="Type email address and press Enter" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6">
                  {currentUser?.role === 'admin' && (
                    <Button
                      type="button"
                      className="bg-red-600 hover:bg-red-700 h-10 px-4 inline-flex items-center gap-2"
                      onClick={() => handleDeleteBrand(showConfigureForm)}
                    >
                      <Trash className="w-4 h-4" />
                      Delete Brand
                    </Button>
                  )}
                  {currentUser?.role !== 'admin' && <div />}
                  <div className="flex gap-2">
                    <Button type="button" onClick={()=>setShowConfigureForm(null)} className="bg-gray-800 hover:bg-gray-700 h-10 px-4">Cancel</Button>
                    <Button type="submit" className="bg-white text-black hover:bg-white/90 h-10 px-4">Update Brand</Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Brand Management</h1>
            <p className="text-gray-400">Manage your brands, keywords, and monitoring platforms</p>
          </div>
        </div>

        {/* Search Bar under header with Create Brand on the right */}
        <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative w-full md:max-w-md flex items-center gap-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              placeholder="Search by brand name or assigned user email"
              className="w-full h-10 pl-9 pr-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400"
              aria-label="Search brands"
            />
            <Button
              type="button"
              onClick={() => setSearchText((s) => s.trim())}
              className="h-10 px-4 bg-white text-black hover:bg-white/90 text-sm rounded-lg"
            >
              Search
            </Button>
            <Button
              type="button"
              onClick={() => fetchBrands()}
              variant="outline"
              size="icon"
              aria-label="Refresh brands"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {currentUser?.role === 'admin' && (
            <Button onClick={() => setShowCreateForm(true)} className="bg-white text-black hover:bg-white/90 w-full md:w-auto">+ Create Brand</Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Card className="bg-red-900/20 border-red-700 text-white mb-6">
            <CardContent className="pt-6">
              <p className="text-red-200">Error: {error}</p>
            </CardContent>
          </Card>
        )}
        {actionMessage && !error && (
          <Card className="bg-emerald-900/20 border-emerald-700 text-white mb-6">
            <CardContent className="pt-6">
              <p className="text-emerald-200">{actionMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Create Brand - Fullscreen Overlay */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 p-4 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateForm(false)} />
            <div className="relative z-10 w-[96vw] max-w-6xl mx-auto bg-black border border-white/10 rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Create Brand</h2>
                <Button onClick={() => setShowCreateForm(false)} className="bg-gray-800 hover:bg-gray-700 h-9 px-3 text-sm">Close</Button>
              </div>
              <form onSubmit={handleCreateBrand}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden">
                        {newBrand.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={newBrand.avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-sm font-semibold">{(newBrand.brandName || 'B').slice(0,1).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="avatar" className="text-sm mb-1.5 inline-block">Upload Brand Logo</Label>
                        <input
                          id="avatar"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            if (file.size > 1024 * 1024) { alert('Please choose an image under 1MB.'); return; }
                            const reader = new FileReader();
                            reader.onload = () => setNewBrand({ ...newBrand, avatarUrl: String(reader.result) });
                            reader.readAsDataURL(file);
                          }}
                          className="block text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Brand Name *</Label>
                      <Input value={newBrand.brandName} onChange={(e)=>setNewBrand({...newBrand, brandName:e.target.value})} required className="bg-gray-800 border-gray-700 text-white h-11 px-4 text-sm rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Country</Label>
                      <Input value={newBrand.country} onChange={(e)=>setNewBrand({...newBrand, country:e.target.value})} className="bg-gray-800 border-gray-700 text-white h-11 px-4 text-sm rounded-lg" placeholder="India" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Select Brand Color</Label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={brandColor} onChange={(e)=>setBrandColor(e.target.value)} className="h-10 w-10 p-0 border border-gray-700 rounded" />
                        <input value={brandColor} onChange={(e)=>setBrandColor(e.target.value)} className="bg-gray-800 border border-gray-700 text-white h-10 px-3 text-sm rounded-lg w-28" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Enable ticket creation</Label>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={()=>setTicketCreation(!ticketCreation)} className={`w-12 h-6 rounded-full relative ${ticketCreation?'bg-blue-600':'bg-gray-700'}`}>
                          <span className={`absolute top-0.5 ${ticketCreation?'left-6':'left-0.5'} transition-all w-5 h-5 rounded-full bg-white`} />
                        </button>
                        <span className="text-xs text-gray-400">By enabling ticket creation, tickets will be created based on mention.</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">AI Friendly Name</Label>
                      <Input value={newBrand.aiFriendlyName} onChange={(e)=>setNewBrand({...newBrand, aiFriendlyName:e.target.value})} className="bg-gray-800 border-gray-700 text-white h-11 px-4 text-sm rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Brand Description</Label>
                      <textarea value={newBrand.description} onChange={(e)=>setNewBrand({...newBrand, description:e.target.value})} rows={6} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-3" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 inline-block">Assign Users (by Email)</Label>
                      <Chips value={assignedUsers} onChange={setAssignedUsers} placeholder="Type email address and press Enter" />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Label className="text-sm mb-1.5 inline-block">Brand Engagement Guidelines</Label>
                  <textarea value={guidelines} onChange={(e)=>setGuidelines(e.target.value)} rows={4} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-3" />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" onClick={()=>setShowCreateForm(false)} className="bg-gray-800 hover:bg-gray-700 h-10 px-4">Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 h-10 px-4">Create Brand</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Brands Table (polished) */}
        <div className="bg-black border border-white/10 rounded-lg overflow-hidden mb-8">
          <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Brand Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Users</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Channels Configured</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Keywords/Topics</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Created On</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Ticket Creation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleBrands.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-gray-400">No matching brands. Adjust your search.</td>
                </tr>
              ) : (
                visibleBrands.map((brand) => (
                  <tr key={brand._id} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
                          {brand.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={brand.avatarUrl} alt={brand.brandName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-gray-400 font-semibold">{(brand.brandName || 'B').slice(0,1).toUpperCase()}</span>
                          )}
                        </span>
                        <span className="text-white">{brand.brandName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(() => {
                        // Debug: log the brand data
                        console.log(`[BrandsPage] Rendering brand "${brand.brandName}":`, {
                          assignedUsers: brand.assignedUsers,
                          assignedUsersType: typeof brand.assignedUsers,
                          isArray: Array.isArray(brand.assignedUsers),
                          length: brand.assignedUsers?.length
                        });
                        
                        // Try multiple possible field names
                        const assignedUsers = brand.assignedUsers || brand.users || brand.members || [];
                        const usersArray = Array.isArray(assignedUsers) 
                          ? assignedUsers.map(u => typeof u === 'string' ? u : (u?.email || u?.user || '')).filter(Boolean)
                          : [];
                        
                        if (usersArray.length > 0) {
                          return (
                            <div className="flex flex-col gap-1">
                              {usersArray.slice(0, 2).map((email, idx) => (
                                <span key={idx} className="text-xs text-gray-400">{email}</span>
                              ))}
                              {usersArray.length > 2 && (
                                <span className="text-xs text-gray-500">+{usersArray.length - 2} more</span>
                              )}
                            </div>
                          );
                        }
                        return <span className="text-gray-500">No users assigned</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button onClick={() => openConfigure(brand)} className="text-white hover:underline">Configure Channels</button>
                      <div className="flex gap-1 mt-1">
                        {(brand.platforms || []).map((p, idx) => (
                          <PlatformBadge key={idx} platform={p} size="xs" />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white border border-white/40">{brand.keywords?.length || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{brand.createdAt ? new Date(brand.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <button className="w-10 h-5 rounded-full bg-gray-700 relative"><span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white" /></button>
                    </td>
                    <td className="px-4 py-3 text-sm"><span className="inline-block px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-300 border border-emerald-700/50">Success</span></td>
                    <td className="px-4 py-3 text-sm"><button onClick={() => openConfigure(brand)} className="text-white hover:underline">Edit</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Old list view hidden */}
        {false && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleBrands.length === 0 ? (
            <Card className="bg-gray-900 border-gray-700 text-white col-span-full">
              <CardContent className="pt-6 text-center">
                <p className="text-gray-400">No matching brands. Adjust your search.</p>
              </CardContent>
            </Card>
          ) : (
            visibleBrands.map((brand) => (
              <Card key={brand._id} className="bg-gray-900 border-gray-700 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
                        {brand.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={brand.avatarUrl} alt={brand.brandName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400 font-semibold">{(brand.brandName || 'B').slice(0,1).toUpperCase()}</span>
                        )}
                      </span>
                      {brand.brandName}
                    </span>
                    <span className="text-xs bg-white text-black px-2 py-1 rounded">
                      {brand.frequency || 'daily'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {brand.description && (
                    <p className="text-gray-400 text-sm mb-4">{brand.description}</p>
                  )}

                  <div className="space-y-3">
                    {/* Keywords */}
                    <div>
                      <p className="text-sm font-semibold text-gray-300 mb-1">Keywords:</p>
                      <div className="flex flex-wrap gap-2">
                        {brand.keywords && brand.keywords.length > 0 ? (
                          brand.keywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-800 px-2 py-1 rounded text-white"
                            >
                              {keyword}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No keywords yet</span>
                        )}
                      </div>
                    </div>

                    {/* Platforms */}
                    <div>
                      <p className="text-sm font-semibold text-gray-300 mb-1">Platforms:</p>
                      <div className="flex flex-wrap gap-2">
                        {brand.platforms && brand.platforms.length > 0 ? (
                          brand.platforms.map((platform, idx) => (
                            <PlatformBadge key={idx} platform={platform} size="sm" />
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No platforms yet</span>
                        )}
                      </div>
                    </div>

                    {/* Configure Button */}
                    <Button
                      onClick={() => openConfigure(brand)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white mt-4"
                    >
                      Configure
                    </Button>

                    {/* Configure Form */}
                    {false && (
                      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                        <form onSubmit={(e) => handleConfigureBrand(e, brand.brandName)}>
                          <div className="space-y-4">
                            {/* Avatar change */}
                            <div>
                              <Label className="text-sm mb-1.5 inline-block">Avatar</Label>
                              <div className="flex items-center gap-4">
                                <span className="w-12 h-12 rounded-full bg-gray-900 border border-gray-700 overflow-hidden flex items-center justify-center">
                                  {(configData.avatarUrl || brand.avatarUrl) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={configData.avatarUrl || brand.avatarUrl} alt={brand.brandName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs text-gray-400 font-semibold">{(brand.brandName || 'B').slice(0,1).toUpperCase()}</span>
                                  )}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 1024 * 1024) {
                                      alert('Please choose an image under 1MB.');
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      setConfigData({ ...configData, avatarUrl: String(reader.result) });
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                  className="block text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`keywords-${brand._id}`} className="text-sm mb-1.5 inline-block">
                                Keywords (comma-separated)
                              </Label>
                              <Input
                                id={`keywords-${brand._id}`}
                                value={configData.keywords}
                                onChange={(e) =>
                                  setConfigData({ ...configData, keywords: e.target.value })
                                }
                                placeholder="nike, sports, shoes"
                                className="bg-gray-700 border-gray-600 text-white text-sm h-10 px-3 rounded-lg"
                              />
                            </div>

                            <div>
                              <Label htmlFor={`frequency-${brand._id}`} className="text-sm mb-1.5 inline-block">
                                Monitoring Frequency
                              </Label>
                              <select
                                id={`frequency-${brand._id}`}
                                value={configData.frequency}
                                onChange={(e) =>
                                  setConfigData({ ...configData, frequency: e.target.value })
                                }
                                className="w-full h-10 px-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                              >
                                <option value="5m">Every 5 Minutes</option>
                                <option value="30m">Every 30 Minutes (Default)</option>
                                <option value="1h">Every 1 Hour</option>
                              </select>
                            </div>

                            <div>
                              <Label className="text-sm mb-2 block">Platforms</Label>
                              <div className="flex gap-3 flex-wrap">
                                {['youtube', 'twitter', 'reddit'].map((platform) => {
                                  const platformConfig = {
                                    youtube: {
                                      icon: '/youtube-logo.svg',
                                      name: 'YouTube',
                                      width: 32,
                                      height: 32
                                    },
                                    twitter: {
                                      icon: '/x-logo.svg',
                                      name: 'X (Twitter)',
                                      width: 28,
                                      height: 28
                                    },
                                    reddit: {
                                      icon: '/reddit-logo.svg',
                                      name: 'Reddit',
                                      width: 32,
                                      height: 32
                                    }
                                  };
                                  const config = platformConfig[platform];
                                  const isSelected = configData.platforms[platform];
                                  
                                  return (
                                    <button
                                      key={platform}
                                      type="button"
                                      onClick={() =>
                                        setConfigData({
                                          ...configData,
                                          platforms: {
                                            ...configData.platforms,
                                            [platform]: !configData.platforms[platform]
                                          }
                                        })
                                      }
                                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 min-w-[112px] ${
                                        isSelected
                                          ? 'bg-white/10 border-white shadow-lg'
                                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                      }`}
                                    >
                                      <Image
                                        src={config.icon}
                                        alt={config.name}
                                        width={config.width}
                                        height={config.height}
                                        className="object-contain"
                                        style={{ filter: 'grayscale(0.2) brightness(0.9)' }}
                                      />
                                      <span className={`text-xs font-semibold ${
                                        isSelected ? 'text-white' : 'text-gray-400'
                                      }`}>
                                        {config.name}
                                      </span>
                                      {isSelected && (
                                        <span className="text-xs text-white">✓</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">Click to select/deselect platforms</p>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                className="flex-1 bg-white text-black hover:bg-white/90 h-10 text-sm rounded-lg"
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                onClick={() => setShowConfigureForm(null)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 h-10 text-sm rounded-lg"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        )}
      </div>
    </div>
  );
}

