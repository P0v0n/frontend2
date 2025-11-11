'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import DottedBackground from '@/components/DottedBackground';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import COUNTRIES from '@/lib/countries';

const inter = Inter({ subsets: ['latin'], weight: ['400','600','700'] });
const SUPPORTED_POST_PLATFORMS = ['twitter', 'youtube', 'reddit'];
const PLATFORM_LABELS = {
  twitter: 'Twitter',
  youtube: 'YouTube',
  reddit: 'Reddit',
};

const formatPostDate = (value) => {
  if (!value) return 'Unknown date';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
};

// Platform icon component with tooltip
const PlatformIcon = ({ platform, isSelected, onClick }) => {
  const icons = {
    youtube: {
      component: <Image src="/youtube-logo.svg" alt="YouTube" width={48} height={48} className="object-contain" style={{ filter: 'grayscale(0.2) brightness(0.9)' }} />,
      bgColor: isSelected ? 'bg-white/10 border-white' : 'bg-gray-800/50 border-gray-700',
      hoverBg: 'hover:bg-white/10 hover:border-white hover:scale-105',
      name: 'YouTube'
    },
    twitter: {
      component: <Image src="/x-logo.svg" alt="X (Twitter)" width={40} height={40} className="object-contain" style={{ filter: 'grayscale(0) brightness(1.1)' }} />,
      bgColor: isSelected ? 'bg-white/10 border-white' : 'bg-gray-800/50 border-gray-700',
      hoverBg: 'hover:bg-white/10 hover:border-white hover:scale-105',
      name: 'X (Twitter)'
    },
    reddit: {
      component: <Image src="/reddit-logo.svg" alt="Reddit" width={48} height={48} className="object-contain" style={{ filter: 'grayscale(0.2) brightness(0.9)' }} />,
      bgColor: isSelected ? 'bg-white/10 border-white' : 'bg-gray-800/50 border-gray-700',
      hoverBg: 'hover:bg-white/10 hover:border-white hover:scale-105',
      name: 'Reddit'
    }
  };

  const icon = icons[platform] || icons.twitter;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={`p-5 rounded-xl border-2 transition-all duration-200 flex items-center justify-center min-w-[90px] min-h-[90px] ${icon.bgColor} ${icon.hoverBg} shadow-md hover:shadow-lg`}
        title={icon.name}
      >
        {icon.component}
      </button>
      {/* Tooltip */}
      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-xl">
        {icon.name}
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-b border-r border-gray-600 rotate-45"></div>
      </div>
    </div>
  );
};

// Lightweight chips input for keywords (Enter to add, click x to remove)
function KeywordChips({ value, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('');
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const k = input.trim();
      if (k && !value.includes(k)) onAdd(k);
      setInput('');
    }
  };
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-2 min-h-[20px]">
        {value.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 border border-gray-700">
            {k}
            <button type="button" onClick={()=>onRemove(k)} className="text-gray-400 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e)=>setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm placeholder-gray-400"
      />
      <p className="text-xs text-gray-400 mt-1">Add keyword separated by pressing 'Enter'</p>
    </div>
  );
}

export default function KeywordsPage() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedBrandData, setSelectedBrandData] = useState(null);
  const [status, setStatus] = useState(""); // '', 'loading', 'done'
  const [resultMessage, setResultMessage] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [brandSearchText, setBrandSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState('');
  const [selectedFilterChannels, setSelectedFilterChannels] = useState([]); // [] = all
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Configuration state
  const [configKeywords, setConfigKeywords] = useState('');
  const [configPlatforms, setConfigPlatforms] = useState([]);
  const [configFrequency, setConfigFrequency] = useState('30m');
  const [configStatus, setConfigStatus] = useState('');
  const [groupName, setGroupName] = useState('');
  const [queryTab, setQueryTab] = useState('basic'); // basic | advanced
  const [andKeywords, setAndKeywords] = useState([]);
  const [orKeywords, setOrKeywords] = useState([]);
  const [notKeywords, setNotKeywords] = useState([]);
  const [andMode, setAndMode] = useState('AND'); // AND | OR radio for AND group
  const [countries, setCountries] = useState([]);
  const handleAddCountry = (code) => {
    if (!code) return;
    if (!countries.includes(code)) setCountries([...countries, code]);
  };
  const removeCountry = (code) => setCountries(countries.filter(c => c !== code));
  const [languages, setLanguages] = useState([]);
  const [keywordGroups, setKeywordGroups] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null); // {groupName, keywords}
  const [brandPosts, setBrandPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');
const [brandKeywords, setBrandKeywords] = useState([]);
const [keywordsLoading, setKeywordsLoading] = useState(false);
const [keywordsError, setKeywordsError] = useState('');
  const storageKeyForBrand = (brand) => `keywordGroups:${brand}`;
  const persistGroups = (brand, groups) => {
    setKeywordGroups(groups);
    try { if (brand) localStorage.setItem(storageKeyForBrand(brand), JSON.stringify(groups)); } catch {}
  };
  
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

  // Update brand data when brand changes
  useEffect(() => {
    if (selectedBrand && brands.length > 0) {
      const brand = brands.find(b => b.brandName === selectedBrand);
      if (brand) {
        setSelectedBrandData(brand);
        // Load configuration data
        setConfigKeywords(brand.keywords?.join(', ') || '');
        setConfigPlatforms(brand.platforms || []);
        setConfigFrequency(brand.frequency || '30m');
        // Load keyword groups: prioritize backend data, then localStorage
        let groupsToUse = [];
        
        // First, check if brand has keywordGroups from backend
        if (brand.keywordGroups && Array.isArray(brand.keywordGroups) && brand.keywordGroups.length > 0) {
          // Backend groups only have: name, keywords, assignedUsers
          // Add missing fields for UI (platforms, countries, languages, paused)
          groupsToUse = brand.keywordGroups.map(group => ({
            name: group.name || '',
            keywords: Array.isArray(group.keywords) ? group.keywords : [],
            assignedUsers: Array.isArray(group.assignedUsers) ? group.assignedUsers : [],
            // UI-only fields (not in backend schema) - use brand defaults or empty
            platforms: Array.isArray(group.platforms) && group.platforms.length > 0 
              ? group.platforms 
              : (brand.platforms || []),
            countries: Array.isArray(group.countries) ? group.countries : [],
            languages: Array.isArray(group.languages) ? group.languages : [],
            paused: group.paused || false
          }));
          // Also save to localStorage for consistency (with UI fields)
          persistGroups(brand.brandName, groupsToUse);
        } else {
          // Fallback to localStorage
          try {
            const storageKey = storageKeyForBrand(brand.brandName);
            const raw = localStorage.getItem(storageKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                groupsToUse = parsed;
                
                // Sync localStorage groups to backend (they exist locally but not in backend)
                const keywordGroupsForBackend = parsed.map(g => ({
                  name: g.name || '',
                  keywords: Array.isArray(g.keywords) ? g.keywords : [],
                  assignedUsers: Array.isArray(g.assignedUsers) ? g.assignedUsers : []
                }));
                
                // Update backend asynchronously (don't wait for it)
                api.brands.configure({
                  brandName: brand.brandName,
                  keywords: brand.keywords || [],
                  platforms: brand.platforms || [],
                  frequency: brand.frequency || '30m',
                  keywordGroups: keywordGroupsForBackend
                }).catch(err => {
                  console.warn('[KeywordsPage] Failed to sync keywordGroups to backend:', err);
                });
              }
            }
          } catch (err) {
            console.warn('[KeywordsPage] Failed to load from localStorage:', err);
          }
        }
        
        setKeywordGroups(groupsToUse);
      }
    }
  }, [selectedBrand, brands]);

  const fetchBrands = async () => {
    try {
      // Get user info from localStorage
      let user = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) user = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user from localStorage:', e);
      }

      // If user is admin, try to get all brands; fallback to user's assigned brands if access denied
      let data;
      if (user?.role === 'admin') {
        try {
          data = await api.brands.getAll();
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
        data = await api.brands.getByUser(user.email);
      } else {
        // Fallback: try to get user email from token or show error
        throw new Error('User not authenticated. Please login again.');
      }
      
      if (!data || !data.brands) {
        throw new Error('Invalid response from server');
      }
      
      setBrands(data.brands || []);
      if (data.brands && data.brands.length > 0) {
        // Only update selectedBrand if it's not already set or if current selection is invalid
        if (!selectedBrand || !data.brands.find(b => b.brandName === selectedBrand)) {
          setSelectedBrand(data.brands[0].brandName);
        }
      }
    } catch (err) {
      console.error('Failed to load brands:', err);
      // Show error message to user
      setResultMessage(`Failed to load brands: ${err.message}`);
    }
  };

  const fetchBrandPosts = useCallback(async () => {
    if (!selectedBrand) {
      setBrandPosts([]);
      return;
    }

    setPostsLoading(true);
    setPostsError('');

    try {
      const params = {
        brandName: selectedBrand,
        limit: 25,
      };

      if (selectedFilterChannels.length === 1) {
        const channel = selectedFilterChannels[0];
        if (SUPPORTED_POST_PLATFORMS.includes(channel)) {
          params.platform = channel;
        }
      }

      const response = await api.dashboard.getPosts(params);
      setBrandPosts(response?.data || []);
    } catch (err) {
      console.error('Failed to load brand posts:', err);
      setPostsError(err.message || 'Failed to load posts');
      setBrandPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [selectedBrand, selectedFilterChannels]);

  const fetchBrandKeywords = useCallback(async () => {
    if (!selectedBrand) {
      setBrandKeywords([]);
      return;
    }

    setKeywordsLoading(true);
    setKeywordsError('');

    try {
      const response = await api.dashboard.getKeywords(selectedBrand);
      setBrandKeywords(response?.keywords || []);
    } catch (err) {
      console.error('Failed to load brand keywords:', err);
      setKeywordsError(err.message || 'Failed to load keywords');
      setBrandKeywords([]);
    } finally {
      setKeywordsLoading(false);
    }
  }, [selectedBrand]);

  useEffect(() => {
    fetchBrandPosts();
    fetchBrandKeywords();
  }, [fetchBrandPosts, fetchBrandKeywords]);

  const handleRefreshBrands = async () => {
    try {
      setRefreshing(true);
      setBrandSearchText('');
      await fetchBrands();
      await fetchBrandPosts();
      await fetchBrandKeywords();
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredBrands = (brands || []).filter((b) => {
    const q = brandSearchText.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      b.brandName,
      Array.isArray(b.keywords) ? b.keywords.join(' ') : ''
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });


  const toggleConfigPlatform = (platformKey) => {
    setConfigPlatforms(prev => (
      prev.includes(platformKey)
        ? prev.filter(p => p !== platformKey)
        : [...prev, platformKey]
    ));
  };

  const handleSaveConfiguration = async () => {
    if (!selectedBrand) {
      alert('Please select a brand');
      return;
    }

    if ((andKeywords.length + orKeywords.length) === 0) {
      alert('Please add at least one keyword');
      return;
    }

    if (configPlatforms.length === 0) {
      alert('Please select at least one platform');
      return;
    }

    setConfigStatus('saving');
    try {
      const keywordsArray = Array.from(new Set([...andKeywords, ...orKeywords]));
      // Map UI channel key(s) to backend platform(s)
      const platformsBackend = (configPlatforms || []).map(k => {
        if (k === 'youtube') return 'youtube';
        if (k === 'reddit' || k === 'quora') return 'reddit';
        return 'twitter'; // twitter, facebook, instagram -> twitter
      });

      // Build final keywords based on editing/new
      const currentAll = selectedBrandData?.keywords || [];
      let finalKeywords = [];
      if (editingGroup) {
        const withoutOld = currentAll.filter(k => !(editingGroup.keywords || []).includes(k));
        finalKeywords = Array.from(new Set([...withoutOld, ...keywordsArray]));
      } else {
        finalKeywords = Array.from(new Set([...currentAll, ...keywordsArray]));
      }

      // Update local groups first (before backend call)
      let updatedGroups = [];
      if (editingGroup) {
        updatedGroups = (keywordGroups || []).map(g =>
          g.name === editingGroup.groupName
            ? { name: groupName || editingGroup.groupName, keywords: keywordsArray, platforms: configPlatforms, countries, languages, paused: g.paused || false }
            : g
        );
      } else {
        const newGroup = { name: groupName || 'New Group', keywords: keywordsArray, platforms: configPlatforms, countries, languages, paused: false };
        updatedGroups = [...(keywordGroups || []), newGroup];
      }

      // Prepare keywordGroups for backend (only name, keywords, assignedUsers - backend schema)
      const keywordGroupsForBackend = updatedGroups.map(g => ({
        name: g.name,
        keywords: g.keywords || [],
        assignedUsers: g.assignedUsers || [] // Keep any assigned users if they exist
      }));

      // Single backend update - include keywordGroups
      console.log('[KeywordsPage] Sending keywordGroups to backend:', keywordGroupsForBackend);
      const configureResponse = await api.brands.configure({
        brandName: selectedBrand,
        keywords: finalKeywords,
        platforms: Array.from(new Set(platformsBackend)),
        frequency: configFrequency,
        keywordGroups: keywordGroupsForBackend // Send keywordGroups to backend
      });

      console.log('[KeywordsPage] Backend configure response:', configureResponse);
      console.log('[KeywordsPage] Brand from response:', configureResponse?.brand);
      console.log('[KeywordsPage] keywordGroups from response:', configureResponse?.brand?.keywordGroups);

      // Update local groups in localStorage (with full data including platforms, countries, languages)
      persistGroups(selectedBrand, updatedGroups);

      setConfigStatus('success');
      
      // The backend configure endpoint returns the updated brand in response.brand
      // Use that directly to update state immediately
      if (configureResponse?.brand) {
        const brand = configureResponse.brand;
        setSelectedBrandData(brand);
        setConfigKeywords(brand.keywords?.join(', ') || '');
        setConfigPlatforms(brand.platforms || []);
        
        // Update keyword groups from backend response if available
        if (brand.keywordGroups && Array.isArray(brand.keywordGroups) && brand.keywordGroups.length > 0) {
          console.log('[KeywordsPage] ✅ Found keywordGroups in backend response, count:', brand.keywordGroups.length);
          const backendGroups = brand.keywordGroups.map(group => ({
            name: group.name || '',
            keywords: Array.isArray(group.keywords) ? group.keywords : [],
            assignedUsers: Array.isArray(group.assignedUsers) ? group.assignedUsers : [],
            platforms: Array.isArray(group.platforms) && group.platforms.length > 0 
              ? group.platforms 
              : (brand.platforms || []),
            countries: Array.isArray(group.countries) ? group.countries : [],
            languages: Array.isArray(group.languages) ? group.languages : [],
            paused: group.paused || false
          }));
          console.log('[KeywordsPage] Processed backend groups:', backendGroups);
          setKeywordGroups(backendGroups);
          persistGroups(selectedBrand, backendGroups);
        } else {
          console.log('[KeywordsPage] ⚠️ No keywordGroups in backend response, using local updatedGroups');
          // If backend doesn't return keywordGroups in response, use our local updatedGroups
          setKeywordGroups(updatedGroups);
        }
      } else {
        console.log('[KeywordsPage] ⚠️ No brand in response, using local updatedGroups');
        // Fallback: use our local updatedGroups if no brand in response
        setKeywordGroups(updatedGroups);
      }
      
      // Update brands array in-place to avoid race with fetchBrands/useEffect
      if (configureResponse?.brand) {
        const updated = configureResponse.brand;
        setBrands(prev =>
          Array.isArray(prev)
            ? prev.map(b => (b.brandName === selectedBrand ? updated : b))
            : prev
        );
      }

      // Refresh dependent panels only (no brand refetch to avoid overwriting fresh state)
      await fetchBrandPosts();
      await fetchBrandKeywords();
      
      alert('✅ Configuration saved successfully!');
      setShowConfig(false);
      setEditingGroup(null);
      setGroupName('');
      setAndKeywords([]);
      setOrKeywords([]);
      setNotKeywords([]);
      setConfigStatus('');
    } catch (error) {
      console.error('Configuration save failed:', error);
      setConfigStatus('error');
      alert(`❌ Failed to save configuration: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBrand) {
      alert("Please select a brand.");
      return;
    }

    // Check if brand has configured keywords
    if (!selectedBrandData?.keywords || selectedBrandData.keywords.length === 0) {
      alert("Please configure keywords for this brand first in Brand Management.");
      return;
    }

    if (!selectedBrandData?.platforms || selectedBrandData.platforms.length === 0) {
      alert("Please configure platforms for this brand first in Brand Management.");
      return;
    }

    setStatus("loading");
    setResultMessage("");

    try {
      // Use the brandsearch endpoint - it automatically searches ALL configured keywords
      const response = await api.search.runBrandSearch({
        brandName: selectedBrand
      });

      setStatus("done");

      // Display summary
      const summary = response.summary || {};
      const totalPosts = (summary.youtube || 0) + (summary.twitter || 0) + (summary.reddit || 0);
      
      setResultMessage(
        `✅ Search completed!\n` +
        `Found ${totalPosts} posts:\n` +
        `• YouTube: ${summary.youtube || 0}\n` +
        `• Twitter: ${summary.twitter || 0}\n` +
        `• Reddit: ${summary.reddit || 0}`
      );
      await fetchBrandPosts();
      await fetchBrandKeywords();
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      setStatus("done");
      setResultMessage(`❌ Search failed: ${error.message}`);
    }
  };


  // Build table rows from groups - only show user-created groups, no defaults
  // Fallback: if there are no saved groups yet, show a default group built from brand keywords
  
  // Debug: Log current state
  console.log('[KeywordsPage RENDER] Current state:', {
    selectedBrand,
    keywordGroups,
    keywordGroupsLength: keywordGroups?.length || 0,
    selectedBrandData: selectedBrandData?.brandName,
    selectedBrandDataKeywordGroups: selectedBrandData?.keywordGroups,
  });
  
  const groupsForDisplay = (keywordGroups && keywordGroups.length > 0)
    ? keywordGroups
    : [{
        name: 'Default Group',
        keywords: Array.isArray(selectedBrandData?.keywords) ? selectedBrandData.keywords : [],
        platforms: Array.isArray(selectedBrandData?.platforms) ? selectedBrandData.platforms : [],
        paused: false,
      }];
  
  console.log('[KeywordsPage RENDER] groupsForDisplay:', groupsForDisplay);
  
  const keywordRows = groupsForDisplay.map((g, i) => {
    const keywords = Array.isArray(g.keywords) ? g.keywords : [];
    const platforms = Array.isArray(g.platforms) ? g.platforms : (selectedBrandData?.platforms || []);
    
    return {
      id: `${g.name}-${i}`,
      groupName: g.name,
      keywords: keywords,
      query: keywords.length > 0 ? `(${keywords.join(' OR ')})` : '',
      channels: platforms,
      platformKeys: platforms,
      countries: Array.isArray(g.countries) ? g.countries : [],
      languages: Array.isArray(g.languages) ? g.languages : [],
      paused: !!g.paused,
      createdOn: selectedBrandData?.updatedAt || null,
      status: 'Collecting data'
    };
  });

  const filteredRows = keywordRows.filter(row => {
    const q = keywordSearch.trim().toLowerCase();
    if (!q) return true;
    const text = [row.groupName, ...(row.keywords || []), row.query].join(' ').toLowerCase();
    return text.includes(q);
  });

  const channelFilteredRows = selectedFilterChannels.length === 0
    ? filteredRows
    : filteredRows.filter(r => (r.channels || []).some(ch => selectedFilterChannels.includes(ch)));

  console.log('[KeywordsPage RENDER] Final filtered rows:', {
    keywordRowsCount: keywordRows.length,
    filteredRowsCount: filteredRows.length,
    channelFilteredRowsCount: channelFilteredRows.length,
    rows: channelFilteredRows.map(r => ({ groupName: r.groupName, keywords: r.keywords }))
  });

  const handleCopyGroup = async (row) => {
    try {
      await navigator.clipboard.writeText(row.query);
      alert('Copied to clipboard');
    } catch (e) {
      console.error('Copy failed', e);
      alert('Failed to copy');
    }
  };

  const handleDeleteGroup = async (row) => {
    if (!selectedBrandData) return;
    const ok = confirm(`Delete keyword group "${row.groupName}"?`);
    if (!ok) return;
    try {
      const updated = (selectedBrandData.keywords || []).filter(k => !(row.keywords || []).includes(k));
      const nextGroups = (keywordGroups || []).filter(g => g.name !== row.groupName);
      
      // Prepare keywordGroups for backend
      const keywordGroupsForBackend = nextGroups.map(g => ({
        name: g.name,
        keywords: g.keywords || [],
        assignedUsers: g.assignedUsers || []
      }));
      
      await api.brands.configure({
        brandName: selectedBrand,
        keywords: updated,
        platforms: selectedBrandData.platforms || [],
        frequency: selectedBrandData.frequency || '30m',
        keywordGroups: keywordGroupsForBackend // Sync keywordGroups to backend
      });
      
      persistGroups(selectedBrand, nextGroups);
      setKeywordGroups(nextGroups); // Update state immediately
      
      // Refresh brands to sync with backend
      await fetchBrands();
      alert('✅ Group deleted successfully');
    } catch (e) {
      console.error('Delete failed', e);
      alert('Failed to delete');
    }
  };

  const handleEditGroup = async (row) => {
    // Open the same overlay pre-filled with group
    const editData = { groupName: row.groupName, keywords: row.keywords || [] };
    setEditingGroup(editData);
    setGroupName(row.groupName);
    setAndKeywords(row.keywords || []);
    setOrKeywords([]);
    setNotKeywords([]);
    // ensure manual text is cleared so removed chips don't persist
    // (legacy input not used anymore)
    const platformsToUse = row.platformKeys && row.platformKeys.length ? row.platformKeys : (configPlatforms.length > 0 ? configPlatforms : selectedBrandData?.platforms || []);
    setConfigPlatforms(platformsToUse);
    setCountries(row.countries || []);
    setLanguages(row.languages || []);
    setShowConfig(true);
  };

  const handlePauseToggle = async (row) => {
    try {
      const next = (keywordGroups || []).map(g => g.name === row.groupName ? { ...g, paused: !g.paused } : g);
      
      // Prepare keywordGroups for backend (pause state is stored in localStorage only, not backend)
      const keywordGroupsForBackend = next.map(g => ({
        name: g.name,
        keywords: g.keywords || [],
        assignedUsers: g.assignedUsers || []
      }));
      
      // Sync to backend
      await api.brands.configure({
        brandName: selectedBrand,
        keywords: selectedBrandData?.keywords || [],
        platforms: selectedBrandData?.platforms || [],
        frequency: selectedBrandData?.frequency || '30m',
        keywordGroups: keywordGroupsForBackend
      });
      
      persistGroups(selectedBrand, next);
      setKeywordGroups(next); // Update state immediately
    } catch (e) {
      console.error('Pause toggle failed', e);
      alert('❌ Failed to update pause status');
    }
  };

  const handleDuplicateGroup = async (row) => {
    try {
      const baseName = `${row.groupName} (copy)`;
      let newName = baseName;
      let counter = 2;
      const names = new Set((keywordGroups || []).map(g => g.name));
      while (names.has(newName)) {
        newName = `${baseName} ${counter++}`;
      }
      const dup = {
        name: newName,
        keywords: row.keywords || [],
        platforms: row.platformKeys || [],
        countries: row.countries || [],
        languages: row.languages || [],
        paused: row.paused || false
      };
      const nextGroups = [...(keywordGroups || []), dup];
      
      // Prepare keywordGroups for backend
      const keywordGroupsForBackend = nextGroups.map(g => ({
        name: g.name,
        keywords: g.keywords || [],
        assignedUsers: g.assignedUsers || []
      }));
      
      // Sync to backend
      await api.brands.configure({
        brandName: selectedBrand,
        keywords: selectedBrandData?.keywords || [],
        platforms: selectedBrandData?.platforms || [],
        frequency: selectedBrandData?.frequency || '30m',
        keywordGroups: keywordGroupsForBackend
      });
      
      persistGroups(selectedBrand, nextGroups);
      setKeywordGroups(nextGroups); // Update state immediately
    } catch (e) {
      console.error('Duplicate failed', e);
      alert('❌ Failed to duplicate group');
    }
  };

  return (
    <div className={`min-h-screen bg-black text-white p-4 relative ${inter.className}`}>
      <DottedBackground />
      <div className="w-full max-w-none relative z-10 px-0">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-100">Keywords Configuration</h1>
        </div>
        {/* Toolbar */}
        <div className="bg-black border border-white/10 rounded-lg p-3 mb-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Label className="text-sm"></Label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className={`w-full md:w-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white ${inter.className}`}
              >
                {filteredBrands.map((brand) => (
                  <option key={brand._id} value={brand.brandName} className={`bg-gray-900 text-white ${inter.className}`}>{brand.brandName}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 min-w-[240px]">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                value={keywordSearch}
                onChange={(e) => setKeywordSearch(e.target.value)}
                placeholder="Search by Group Name, Keyword"
                className="w-full h-10 pl-9 pr-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Search keywords"
              />
            </div>

            <div className="flex items-center gap-2 relative flex-wrap">
              <Button
                type="button"
                onClick={handleRefreshBrands}
                variant="outline"
                size="icon"
                title="Refresh"
                aria-label="Refresh brands"
                disabled={refreshing}
                className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              {/* Channel Filter (logo dropdown) */}
              <div className="relative">
                <button
                  onClick={()=>setFilterOpen(!filterOpen)}
                  title="Filter by channel"
                  className="h-9 px-3 bg-gray-800 border border-gray-700 rounded-md text-white text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  {selectedFilterChannels.length === 0 ? (
                    <span className="text-xs">All</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      {selectedFilterChannels.slice(0,4).map((ch) => (
                        ch === 'youtube' ? <Image key={ch} src="/youtube-logo.svg" alt="YouTube" width={16} height={16} /> :
                        ch === 'twitter' ? <Image key={ch} src="/x-logo.svg" alt="X" width={14} height={14} /> :
                        ch === 'reddit' ? <Image key={ch} src="/reddit-logo.svg" alt="Reddit" width={16} height={16} /> :
                        ch === 'facebook' ? <Image key={ch} src="/facebook-logo.svg" alt="Facebook" width={16} height={16} /> :
                        ch === 'instagram' ? <Image key={ch} src="/instagram-logo.svg" alt="Instagram" width={16} height={16} /> :
                        ch === 'quora' ? <Image key={ch} src="/quora-logo.svg" alt="Quora" width={16} height={16} /> : null
                      ))}
                      {selectedFilterChannels.length > 4 && <span className="text-[10px]">+{selectedFilterChannels.length-4}</span>}
                    </div>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-gray-900 border border-gray-800 rounded-md shadow-lg z-50 p-1">
                    <label className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-800 cursor-pointer">
                      <input type="checkbox" checked={selectedFilterChannels.length===0} onChange={()=> setSelectedFilterChannels([])} />
                      All Channels
                    </label>
                    {[
                      { key:'youtube', label:'YouTube', src:'/youtube-logo.svg', wh:[16,16] },
                      { key:'twitter', label:'X (Twitter)', src:'/x-logo.svg', wh:[14,14] },
                      { key:'reddit', label:'Reddit', src:'/reddit-logo.svg', wh:[16,16] },
                      { key:'facebook', label:'Facebook', src:'/facebook-logo.svg', wh:[16,16] },
                      { key:'instagram', label:'Instagram', src:'/instagram-logo.svg', wh:[16,16] },
                      { key:'quora', label:'Quora', src:'/quora-logo.svg', wh:[16,16] }
                    ].map(p => (
                      <label key={p.key} className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFilterChannels.includes(p.key)}
                          onChange={() => {
                            setSelectedFilterChannels(prev => {
                              const set = new Set(prev);
                              if (set.has(p.key)) { set.delete(p.key); } else { set.add(p.key); }
                              return Array.from(set);
                            });
                          }}
                        />
                        <Image src={p.src} alt={p.label} width={p.wh[0]} height={p.wh[1]} />
                        <span>{p.label}</span>
                      </label>
                    ))}
                    <div className="flex justify-end gap-2 px-2 py-1">
                      <button onClick={()=>setFilterOpen(false)} className="text-xs text-gray-300 hover:text-white">Close</button>
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={() => { setEditingGroup(null); setGroupName(''); setAndKeywords([]); setOrKeywords([]); setNotKeywords([]); setConfigPlatforms([]); setCountries([]); setLanguages([]); setShowConfig(true); }} className="bg-white text-black hover:bg-white/90 shadow">
                Add Keywords/Social Profiles
              </Button>
              <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
                Run Search
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-black border border-white/10 rounded-lg">
          <div className="w-full">
            <table className="w-full table-auto">
              <thead className="bg-black">
                <tr>
                  <th className="px-5 py-3 text-left text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">Keywords Group Name </th>
                  <th className="px-5 py-3 text-left text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">Keywords/Keywords Query</th>
                  <th className="px-5 py-3 text-left text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">Channels</th>
                  <th className="px-5 py-3 text-left text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">Created On</th>
                  <th className="px-5 py-3 text-left text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {channelFilteredRows.map(row => (
                  <tr key={row.id} className="border-t border-gray-800 hover:bg-gray-800/40 even:bg-gray-900/40">
                    <td className="px-5 py-4 text-sm text-slate-100">{row.groupName}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div className="flex flex-wrap gap-2">
                        {(row.keywords || []).map((kw)=> (
                          <span key={kw} className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/30 text-white text-xs">{kw}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {row.channels?.map((plat, idx) => (
                          <span key={idx} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 border border-gray-700">
                            {plat === 'youtube' && (
                              <Image src="/youtube-logo.svg" alt="YouTube" width={16} height={16} />
                            )}
                            {plat === 'twitter' && (
                              <Image src="/x-logo.svg" alt="X" width={14} height={14} />
                            )}
                            {plat === 'reddit' && (
                              <Image src="/reddit-logo.svg" alt="Reddit" width={16} height={16} />
                            )}
                            {plat === 'facebook' && (
                              <Image src="/facebook-logo.svg" alt="Facebook" width={16} height={16} />
                            )}
                            {plat === 'instagram' && (
                              <Image src="/instagram-logo.svg" alt="Instagram" width={16} height={16} />
                            )}
                            {plat === 'quora' && (
                              <Image src="/quora-logo.svg" alt="Quora" width={16} height={16} />
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300">{row.createdOn ? new Date(row.createdOn).toLocaleDateString() : '-'}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs whitespace-nowrap border ${row.paused ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-green-900/30 text-green-300 border-green-700'}`}>
                        {row.paused ? 'Paused' : row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300 relative">
                      <div className="flex items-center gap-3">
                          <button onClick={()=>handlePauseToggle(row)} className="text-gray-200 hover:text-white border border-gray-700 px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-white">{row.paused ? 'Resume' : 'Pause'}</button>
                        <button onClick={()=> setOpenMenuId(openMenuId===row.id?null:row.id)} className="text-gray-400 hover:text-white w-8 h-8 rounded-md border border-gray-700 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white">⋯</button>
                      </div>
                      {openMenuId===row.id && (
                        <div className="absolute right-4 mt-2 w-44 bg-gray-900 border border-gray-800 rounded shadow-lg z-50">
                          <button onClick={()=>{ handleDuplicateGroup(row); setOpenMenuId(null); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-800">Duplicate</button>
                          <button onClick={()=>{ handleEditGroup(row); setOpenMenuId(null); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-800">Edit</button>
                          <button onClick={()=>{ handleDeleteGroup(row); setOpenMenuId(null); }} className="block w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-gray-800">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400">No keywords found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration Panel (Add Keywords/Social Profiles) */}
            {showConfig && selectedBrand && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={()=>setShowConfig(false)}>
                <div className="bg-gray-900 border border-gray-800 text-white rounded-lg max-w-6xl w-[95vw] mx-auto shadow-xl" onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold">Real Time Keywords Configuration</h2>
                    <button className="text-gray-400 hover:text-white" onClick={()=>{ setShowConfig(false); setEditingGroup(null); }}>✕</button>
                  </div>
                  <div className="px-6 py-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Side */}
                    <div className="space-y-4">
                      <div className="bg-gray-850/40 border border-gray-800 rounded-lg p-4">
                        <Label className="text-sm mb-2 block">Name Your Keywords Group</Label>
                        <p className="text-xs text-gray-400 mb-2">Add a title that explains the purpose of the Keywords group.</p>
                        <div className="relative">
                          <Input
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Keywords Group Name *"
                            className="bg-gray-800 border-gray-700 text-white h-11"
                            maxLength={30}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{`${groupName.length}/30`}</span>
                        </div>
                      </div>

                      <div className="bg-gray-850/40 border border-gray-800 rounded-lg p-4">
                        <Label className="text-sm mb-2 block">Pick Your Channels</Label>
                        <p className="text-xs text-gray-400 mb-3">Select at least one network to listen to.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Core platforms (map to existing) */}
                          {[
                            { key: 'twitter', title: 'Twitter', desc: 'Tweets, Replies, Mentions', logo: '/x-logo.svg', size: 16 },
                            { key: 'facebook', title: 'Facebook', desc: 'Posts, Visitor Post', logo: '/facebook-logo.svg', size: 16 },
                            { key: 'instagram', title: 'Instagram', desc: 'Posts only', logo: '/instagram-logo.svg', size: 16 },
                            { key: 'youtube', title: 'YouTube', desc: 'Video post only', logo: '/youtube-logo.svg', size: 18 },
                            { key: 'reddit', title: 'Reddit', desc: 'Communities & comments', logo: '/reddit-logo.svg', size: 18 },
                            { key: 'quora', title: 'Quora', desc: 'Question, Answers, Comment', logo: '/quora-logo.svg', size: 16 }
                          ].map((ch) => {
                            const active = configPlatforms.includes(ch.key);
                            return (
                              <button
                                type="button"
                                key={ch.key}
                                onClick={() => toggleConfigPlatform(ch.key)}
                                className={`text-left p-3 rounded-lg border transition ${active ? 'border-white bg-white/10' : 'border-gray-800 bg-gray-900 hover:bg-gray-800/70'}`}
                              >
                                <div className="flex items-center gap-2">
                                  {ch.logo ? (
                                    <Image src={ch.logo} alt={ch.title} width={ch.size} height={ch.size} />
                                  ) : (
                                    <span className="w-4 h-4 rounded-full bg-gray-700 inline-block" />
                                  )}
                                  <div className="font-medium">{ch.title}</div>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{ch.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-gray-850/40 border border-gray-800 rounded-lg p-4">
                        <Label className="text-sm mb-2 block">Monitoring Frequency</Label>
                        <select
                          id="config-frequency"
                          value={configFrequency}
                          onChange={(e) => setConfigFrequency(e.target.value)}
                          className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white ${inter.className}`}
                        >
                          <option value="5m" className={`bg-gray-900 text-white ${inter.className}`}>Every 5 Minutes</option>
                          <option value="30m" className={`bg-gray-900 text-white ${inter.className}`}>Every 30 Minutes (Default)</option>
                          <option value="1h" className={`bg-gray-900 text-white ${inter.className}`}>Every 1 Hour</option>
                        </select>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="space-y-4">
                      <div className="bg-gray-850/40 border border-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <button className={`px-3 py-1.5 rounded-md text-sm ${queryTab==='basic'?'bg-white text-black':'bg-gray-800 text-gray-300'}`} onClick={()=>setQueryTab('basic')}>Basic Query Builder</button>
                          <button className={`px-3 py-1.5 rounded-md text-sm ${queryTab==='advanced'?'bg-white text-black':'bg-gray-800 text-gray-300'}`} onClick={()=>setQueryTab('advanced')}>Advance Query Builder</button>
                        </div>

                        {/* Included (AND) */}
                        <div className="mb-3">
                          <div className="flex items-center gap-3 mb-2">
                            <Label className="text-sm">Included Keywords (AND)</Label>
                            <label className="flex items-center gap-1 text-xs text-gray-300">
                              <input type="radio" checked={andMode==='AND'} onChange={()=>setAndMode('AND')} /> AND
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-300">
                              <input type="radio" checked={andMode==='OR'} onChange={()=>setAndMode('OR')} /> OR
                            </label>
                          </div>
                          <KeywordChips value={andKeywords} onAdd={(k)=>setAndKeywords([...andKeywords,k])} onRemove={(k)=>setAndKeywords(andKeywords.filter(x=>x!==k))} placeholder="Add New Keyword" />
                        </div>

                        {/* Included (OR) */}
                        <div className="mb-3">
                          <Label className="text-sm">Included Keywords (OR)</Label>
                          <KeywordChips value={orKeywords} onAdd={(k)=>setOrKeywords([...orKeywords,k])} onRemove={(k)=>setOrKeywords(orKeywords.filter(x=>x!==k))} placeholder="Add New Keyword" />
                        </div>

                        {/* Excluded (NOT) */}
                        <div className="mb-3">
                          <Label className="text-sm">Excluded Keywords (NOT)</Label>
                          <KeywordChips value={notKeywords} onAdd={(k)=>setNotKeywords([...notKeywords,k])} onRemove={(k)=>setNotKeywords(notKeywords.filter(x=>x!==k))} placeholder="Add New Keyword" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm mb-2 block">Select Countries</Label>
                            {/* Selected chips */}
                            <div className="flex flex-wrap gap-2 mb-2 min-h-[20px]">
                              {countries.map(code => {
                                const name = (COUNTRIES.find(c=>c.code===code)||{}).name || code;
                                return (
                                  <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 border border-gray-700">
                                    {name}
                                    <button type="button" className="text-gray-400 hover:text-white" onClick={()=>removeCountry(code)}>×</button>
                                  </span>
                                );
                              })}
                              {countries.length === 0 && (
                                <span className="text-xs text-gray-400">No countries selected</span>
                              )}
                            </div>
                            {/* Single-select dropdown that closes after pick */}
                            <select
                              value=""
                              onChange={(e)=>{ handleAddCountry(e.target.value); e.target.blur(); }}
                              className={`w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-md text-white ${inter.className}`}
                            >
                              <option value="" disabled className={`bg-gray-900 text-white ${inter.className}`}>Choose a country…</option>
                              {COUNTRIES.map((c)=> (
                                <option key={c.code} value={c.code} className={`bg-gray-900 text-white ${inter.className}`}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-sm mb-2 block">Select Language</Label>
                            <KeywordChips
                              value={languages}
                              onAdd={(v)=> setLanguages([...languages, v])}
                              onRemove={(v)=> setLanguages(languages.filter(x=>x!==v))}
                              placeholder="Type a language (e.g., English, Hindi) and press Enter"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button onClick={()=>{ setShowConfig(false); setEditingGroup(null); }} variant="outline" className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800">Cancel</Button>
                        <Button onClick={handleSaveConfiguration} disabled={configStatus==='saving'} className="bg-white text-black hover:bg-white/90 w-28">{configStatus==='saving'?'Saving...':'Save'}</Button>
                      </div>
                    </div>
                  </div>

                  {/* Manual keywords input removed – builder is source of truth */}
                  </div>
                </div>
              </div>
            )}

      </div>
    </div>
  );
}
