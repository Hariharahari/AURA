import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { 
  GitHub, Terminal, Timeline, Description, Share, Download, 
  Chat as ChatIcon, Send, LightMode, DarkMode, Fullscreen, FullscreenExit,
  Campaign, AccountTree // 🔥 NEW: Added AccountTree icon for the graph toggle button
} from '@mui/icons-material';

function App() {
  const [url, setUrl] = useState('');
  const [repoName, setRepoName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [report, setReport] = useState('');
  const [notes, setNotes] = useState('');
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState('report');
  
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  
  // 🔥 NEW: State to track if the graph panel is visible (hidden by default)
  const [showGraphPanel, setShowGraphPanel] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mounted = useRef(true);
  const chatEndRef = useRef(null);
  
  const fgRef = useRef(null);

  const theme = useMemo(() => createTheme({
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: { main: '#1976d2' },
      background: {
        default: isDarkMode ? '#02040a' : '#f1f5f9',
        paper: isDarkMode ? '#0d1117' : '#ffffff',
      },
    },
  }), [isDarkMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    mounted.current = true;
    fetchHistory();
    return () => (mounted.current = false);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/repos');
      if (mounted.current) setHistory(res.data.repos);
    } catch {}
  };

  const analyze = async (e) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/analyze', { url });
      setRepoName(res.data.repo_name);
      await load(res.data.repo_name);
      fetchHistory();
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const downloadPDF = () => {
    window.print();
  };

  const load = async (name) => {
    const r = await axios.get(`http://localhost:8000/api/reports/${name}`);
    const g = await axios.get(`http://localhost:8000/api/graph/${name}`);
    
    let nData = "Release notes not found. Try analyzing the repository again.";
    try {
        const n = await axios.get(`http://localhost:8000/api/notes/${name}`);
        nData = n.data.content;
    } catch (e) {
        console.warn("Could not load release notes for", name);
    }

    if (!mounted.current) return;
    setReport(r.data.content);
    setNotes(nData);
    setGraph(g.data);
    
    setHighlightNodes(new Set());
    
    setChatHistory([{ role: 'bot', text: `Hello! I am AURA. You can ask me anything about the **${name}** codebase.` }]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatHistory(prev => [
      ...prev, 
      { role: 'user', text: userMessage },
      { role: 'bot', text: '' } 
    ]);
    
    setChatInput('');
    setIsChatting(true);
    
    setHighlightNodes(new Set());

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: repoName,
          question: userMessage
        })
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumulatedAnswer = "";
      
      let graphTriggered = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulatedAnswer += chunk;
          
          const graphMatch = accumulatedAnswer.match(/<ui_graph>([\s\S]*?)<\/ui_graph>/);
          if (graphMatch && !graphTriggered) {
            const files = graphMatch[1].split(',').map(f => f.trim());
            setHighlightNodes(new Set(files));
            
            // 🔥 SMART FEATURE: If AI targets files, automatically open the graph panel!
            setShowGraphPanel(true);
            
            // Short delay to allow the DOM to render the canvas before hitting the physics engine
            setTimeout(() => {
                if (fgRef.current) {
                    fgRef.current.d3ReheatSimulation();
                }
            }, 150);
            
            graphTriggered = true;
          }
          
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1].text = accumulatedAnswer;
            return newHistory;
          });
        }
      }
    } catch (err) {
      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1].text = "⚠️ Error connecting to the AURA Agent. Make sure the backend is running.";
        return newHistory;
      });
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      <GlobalStyles styles={{
        '@media print': {
          '.no-print': { display: 'none !important' },
          'html, body, #root': {
            display: 'block !important', height: 'auto !important', minHeight: 'auto !important',
            overflow: 'visible !important', position: 'static !important', margin: '0 !important',
            padding: '0 !important', backgroundColor: 'white !important',
            color: 'black !important',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif !important',
          },
          '.prose-container p, .prose-container li, .prose-container strong, .prose-container span': {
            color: 'black !important'
          },
          '.prose-container h1': { color: 'black !important', borderBottomColor: '#ccc !important' },
          '.prose-container h2': { color: '#1d4ed8 !important' },
          '.prose-container h3': { color: '#2563eb !important' },
          '.notes-container h1': { color: 'black !important', borderBottomColor: '#ccc !important' },
          '.notes-container h2': { color: '#16a34a !important' },
          '.notes-container h3': { color: '#22c55e !important' },
          'pre': {
            whiteSpace: 'pre-wrap !important', wordWrap: 'break-word !important',
            wordBreak: 'break-word !important', pageBreakInside: 'auto !important',
            backgroundColor: '#f8fafc !important', border: '1px solid #e2e8f0 !important',
            color: 'black !important', padding: '12px !important',
            fontFamily: 'Consolas, "Courier New", monospace !important',
          },
          'code': {
            whiteSpace: 'pre-wrap !important', wordWrap: 'break-word !important',
            color: '#1d4ed8 !important', fontSize: '10pt !important',
            fontFamily: 'Consolas, "Courier New", monospace !important',
          },
          'h1': { pageBreakBefore: 'always !important', marginTop: '20px !important' },
          'h1:first-of-type': { pageBreakBefore: 'avoid !important', marginTop: '0 !important' },
          'img': { maxWidth: '100% !important', height: 'auto !important', pageBreakInside: 'avoid !important' }
        }
      }} />

      <Box sx={{ 
        minHeight: '100vh', bgcolor: 'background.default',
        '@media print': { display: 'block !important', height: 'auto !important' }
      }}>
        
        {!isFullscreen && (
          <AppBar position="static" sx={{ 
            bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
            '@media print': { display: 'none !important' } 
          }}>
            <Toolbar>
              <Terminal sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', letterSpacing: '0.1em', color: 'text.primary' }}>
                AURA
              </Typography>
              <Timeline sx={{ mr: 2, color: 'success.main', animation: 'pulse 2s infinite' }} />
              
              <Tooltip title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}>
                <IconButton onClick={() => setIsDarkMode(!isDarkMode)} sx={{ mr: 2, color: 'text.primary' }}>
                  {isDarkMode ? <LightMode /> : <DarkMode />}
                </IconButton>
              </Tooltip>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Memory Logs</InputLabel>
                <Select
                  value={repoName} label="Memory Logs"
                  onChange={(e) => { setRepoName(e.target.value); load(e.target.value); setPage('report'); setIsFullscreen(false); }}
                  sx={{ bgcolor: 'background.paper' }}
                >
                  <MenuItem value=""><em>New Repo</em></MenuItem>
                  {history.map((h) => (<MenuItem key={h} value={h}>{h.toUpperCase()}</MenuItem>))}
                </Select>
              </FormControl>
            </Toolbar>
          </AppBar>
        )}

        {!repoName && (
          <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center', '@media print': { display: 'none !important' } }}>
            <Typography variant="h2" component="h1" sx={{ mb: 4, fontWeight: 'bold', color: 'text.primary', textShadow: isDarkMode ? '0 0 20px rgba(59,130,246,0.3)' : 'none' }}>
              AURA
            </Typography>
            <Typography variant="h6" sx={{ mb: 6, color: 'text.secondary' }}>
              Deep-dive into codebases with AI-driven insights and visualize complex dependencies in real-time.
            </Typography>

            <Card sx={{ 
              p: 2, 
              bgcolor: isDarkMode ? 'rgba(15,23,42,0.5)' : 'background.paper', 
              border: isDarkMode ? '2px solid rgba(37,99,235,0.5)' : '2px solid rgba(0,0,0,0.1)', 
              boxShadow: isDarkMode ? '0 0 40px rgba(37,99,235,0.2)' : 3 
            }}>
              <form onSubmit={analyze}>
                <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'background.default', borderRadius: 2, overflow: 'hidden' }}>
                  <GitHub sx={{ ml: 3, color: 'text.secondary' }} />
                  <TextField
                    fullWidth placeholder="Insert GitHub Repository URL..." value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    sx={{ '& .MuiInputBase-input': { pl: 3, py: 3 } }} variant="standard" InputProps={{ disableUnderline: true }}
                  />
                  <Button
                    type="submit" disabled={loading} variant="contained"
                    sx={{ px: 5, py: 3, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {loading ? 'Analyzing...' : 'Initiate Analysis'}
                  </Button>
                </Box>
              </form>
            </Card>
          </Container>
        )}

        {repoName && (
          <Box sx={{ 
            display: 'flex', flexDirection: 'column', 
            height: isFullscreen ? '100vh' : 'calc(100vh - 64px)',
            '@media print': { display: 'block !important', height: 'auto !important', overflow: 'visible !important' }
          }}>
            
            {!isFullscreen && (
              <Box sx={{ 
                borderBottom: 1, borderColor: 'divider', px: 5,
                '@media print': { display: 'none !important' } 
              }}>
                <Tabs value={page} onChange={(e, newValue) => setPage(newValue)} sx={{ pt: 3 }} variant="scrollable" scrollButtons="auto">
                  <Tab value="report" icon={<Description />} label="Project Document" iconPosition="start" />
                  <Tab value="notes" icon={<Campaign />} label="Release Notes" iconPosition="start" />
                  <Tab value="graph" icon={<Share />} label="Dependency Graph" iconPosition="start" />
                  <Tab value="chat" icon={<ChatIcon />} label="Ask AURA" iconPosition="start" />
                </Tabs>
              </Box>
            )}

            <Box sx={{ 
              flex: 1, overflow: 'auto', p: isFullscreen ? 0 : 5,
              '@media print': { display: 'block !important', overflow: 'visible !important', p: 0, m: 0 }
            }}>
              
              {/* TAB 1: TECHNICAL REPORT */}
              {page === 'report' && (
                <Container maxWidth={isFullscreen ? false : "lg"} sx={{ height: '100%', '@media print': { maxWidth: '100% !important', p: 0, m: 0 } }}>
                  <Card sx={{ 
                    p: isFullscreen ? 6 : 8, 
                    minHeight: isFullscreen ? '100vh' : 'auto',
                    bgcolor: 'background.paper', 
                    border: isFullscreen ? 'none' : '1px solid', borderColor: 'divider', 
                    borderRadius: isFullscreen ? 0 : 10, boxShadow: isFullscreen ? 'none' : 3,
                    '@media print': { p: 0, border: 'none !important', boxShadow: 'none !important', borderRadius: 0, bgcolor: 'white !important' }
                  }}>
                    <Box sx={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2,
                      '@media print': { display: 'none !important' } 
                    }}>
                      <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Repository Analysis Report</Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                          variant="outlined" 
                          startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />} 
                          onClick={() => setIsFullscreen(!isFullscreen)} 
                          sx={{ textTransform: 'none' }}
                        >
                          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </Button>
                        <Button variant="contained" startIcon={<Download />} onClick={downloadPDF} sx={{ textTransform: 'none' }}>Download PDF</Button>
                      </Box>
                    </Box>
                    <Box sx={{ position: 'relative' }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, bgcolor: 'primary.main', opacity: 0.5, '@media print': { display: 'none !important' } }} />
                      
                      <Box className="prose-container" sx={{ 
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        '& h1': { color: 'text.primary', fontSize: '2.5rem', fontWeight: 900, mt: 6, mb: 3, pb: 1, borderBottom: 1, borderColor: 'divider' }, 
                        '& h2': { color: isDarkMode ? '#60a5fa' : '#1d4ed8', fontSize: '1.8rem', fontWeight: 700, mt: 5, mb: 2 }, 
                        '& h3': { color: isDarkMode ? '#93c5fd' : '#2563eb', fontSize: '1.4rem', fontWeight: 600, mt: 4, mb: 1.5 }, 
                        '& p': { color: 'text.secondary', fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }, 
                        '& strong': { color: 'text.primary', fontWeight: 700 }, 
                        '& li': { color: 'text.secondary', fontSize: '1.15rem', lineHeight: 1.8, mb: 1 },
                        '& pre': { bgcolor: isDarkMode ? '#0f172a' : '#f8fafc', p: 3, borderRadius: 2, mb: 4, border: 1, borderColor: 'divider', overflowX: 'auto', fontFamily: 'Consolas, "Courier New", monospace' },
                        '& code': { color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontFamily: 'Consolas, "Courier New", monospace' },
                        '& img': { maxWidth: '100%', borderRadius: '8px', mt: 2, mb: 4 },
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                      </Box>
                    </Box>
                  </Card>
                </Container>
              )}

              {/* TAB 2: RELEASE NOTES */}
              {page === 'notes' && (
                <Container maxWidth={isFullscreen ? false : "md"} sx={{ height: '100%', '@media print': { maxWidth: '100% !important', p: 0, m: 0 } }}>
                  <Card sx={{ 
                    p: isFullscreen ? 6 : 8, 
                    minHeight: isFullscreen ? '100vh' : 'auto',
                    bgcolor: 'background.paper', 
                    border: isFullscreen ? 'none' : '1px solid', borderColor: 'divider', 
                    borderRadius: isFullscreen ? 0 : 10, boxShadow: isFullscreen ? 'none' : 3,
                    '@media print': { p: 0, border: 'none !important', boxShadow: 'none !important', borderRadius: 0, bgcolor: 'white !important' }
                  }}>
                    <Box sx={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2,
                      '@media print': { display: 'none !important' } 
                    }}>
                      <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Product Release Notes</Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                          variant="outlined" color="success"
                          startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />} 
                          onClick={() => setIsFullscreen(!isFullscreen)} 
                          sx={{ textTransform: 'none' }}
                        >
                          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </Button>
                        <Button variant="contained" color="success" startIcon={<Download />} onClick={downloadPDF} sx={{ textTransform: 'none' }}>Download PDF</Button>
                      </Box>
                    </Box>
                    <Box sx={{ position: 'relative' }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, bgcolor: 'success.main', opacity: 0.5, '@media print': { display: 'none !important' } }} />
                      
                      <Box className="prose-container notes-container" sx={{ 
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        '& h1': { color: 'success.main', fontSize: '2.5rem', fontWeight: 900, mt: 6, mb: 3, pb: 1, borderBottom: 1, borderColor: 'divider' }, 
                        '& h2': { color: isDarkMode ? '#4ade80' : '#16a34a', fontSize: '1.8rem', fontWeight: 700, mt: 5, mb: 2 }, 
                        '& h3': { color: isDarkMode ? '#86efac' : '#22c55e', fontSize: '1.4rem', fontWeight: 600, mt: 4, mb: 1.5 }, 
                        '& p': { color: 'text.secondary', fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }, 
                        '& strong': { color: 'text.primary', fontWeight: 700 }, 
                        '& li': { color: 'text.secondary', fontSize: '1.15rem', lineHeight: 1.8, mb: 1 },
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
                      </Box>
                    </Box>
                  </Card>
                </Container>
              )}

              {/* TAB 3: DEPENDENCY GRAPH */}
              {page === 'graph' && (
                <Card className="no-print" sx={{ position: 'relative', height: '100%', bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'background.paper', border: 1, borderColor: 'divider', borderRadius: isFullscreen ? 0 : 4, overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                    <Button 
                      variant="contained" 
                      color="secondary"
                      startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />} 
                      onClick={() => setIsFullscreen(!isFullscreen)}
                    >
                      {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </Button>
                  </Box>
                  <ForceGraph2D 
                    key={`${repoName}-${isDarkMode}-${isFullscreen}`} 
                    graphData={graph} 
                    backgroundColor="rgba(0,0,0,0)" 
                    linkColor={() => isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"} 
                    nodeRelSize={10} 
                  />
                </Card>
              )}

              {/* TAB 4: INTERACTIVE "MINORITY REPORT" SPLIT-SCREEN CHAT */}
              {page === 'chat' && (
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, height: '100%' }}>
                  
                  {/* LEFT SIDE: Chat Interface */}
                  <Card className="no-print" sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: isFullscreen ? 0 : 4, overflow: 'hidden' }}>
                    <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: isDarkMode ? '#0f172a' : '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        <Terminal sx={{ mr: 1, color: 'primary.main' }} /> Ask AURA
                      </Typography>
                      
                      {/* 🔥 NEW: Controls container for Graph Toggle and Fullscreen */}
                      <Box>
                        <Tooltip title={showGraphPanel ? "Hide Network Graph" : "Show Network Graph"}>
                          <IconButton onClick={() => setShowGraphPanel(!showGraphPanel)} color="secondary" sx={{ mr: 1 }}>
                            <AccountTree />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                          <IconButton onClick={() => setIsFullscreen(!isFullscreen)} color="primary">
                            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Box sx={{ flex: 1, p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {chatHistory.map((msg, index) => {
                        const displayText = msg.text.replace(/<ui_graph>[\s\S]*?<\/ui_graph>/g, '').trim();
                        return (
                          <Box key={index} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            <Box sx={{ 
                              maxWidth: '85%', p: 2, borderRadius: 2,
                              bgcolor: msg.role === 'user' ? 'primary.main' : (isDarkMode ? '#1e293b' : '#f8fafc'), 
                              color: msg.role === 'user' ? '#ffffff' : 'text.primary',
                              border: msg.role !== 'user' && !isDarkMode ? '1px solid rgba(0,0,0,0.1)' : 'none',
                              '& pre': { bgcolor: isDarkMode ? '#0f172a' : '#e2e8f0', p: 2, borderRadius: 2, overflowX: 'auto', mt: 1, fontFamily: 'Consolas, "Courier New", monospace' },
                              '& code': { fontFamily: 'Consolas, "Courier New", monospace', color: msg.role === 'user' ? '#ffffff' : (isDarkMode ? '#93c5fd' : '#1d4ed8') }
                            }}>
                              {msg.role === 'user' ? (<Typography>{displayText}</Typography>) : (<ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>)}
                            </Box>
                          </Box>
                        );
                      })}
                      
                      {isChatting && chatHistory[chatHistory.length - 1]?.text === '' && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDarkMode ? '#1e293b' : '#f8fafc', color: 'text.secondary', border: !isDarkMode ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
                            <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> Searching Codebase...
                          </Box>
                        </Box>
                      )}
                      <div ref={chatEndRef} />
                    </Box>

                    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: isDarkMode ? '#0f172a' : '#f1f5f9' }}>
                      <form onSubmit={handleSendMessage}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField 
                            fullWidth variant="outlined" placeholder={`Ask a question about ${repoName}...`}
                            value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isChatting}
                            sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#ffffff' } }}
                          />
                          <Button type="submit" variant="contained" disabled={isChatting || !chatInput.trim()} sx={{ px: 3 }}>
                            <Send />
                          </Button>
                        </Box>
                      </form>
                    </Box>
                  </Card>

                  {/* RIGHT SIDE: Interactive Graph View (Conditionally Rendered) */}
                  {showGraphPanel && (
                    <Card className="no-print" sx={{ flex: 1, position: 'relative', bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'background.paper', border: 1, borderColor: 'divider', borderRadius: isFullscreen ? 0 : 4, overflow: 'hidden' }}>
                      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, bgcolor: 'background.paper', px: 2, py: 1, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: highlightNodes.size > 0 ? 'error.main' : 'text.secondary' }}>
                          {highlightNodes.size > 0 ? `Target Locked: ${highlightNodes.size} Modules` : 'Awaiting Context...'}
                        </Typography>
                      </Box>
                      <ForceGraph2D 
                        ref={fgRef}
                        key={`interactive-${repoName}-${isDarkMode}`} 
                        graphData={graph} 
                        backgroundColor="rgba(0,0,0,0)" 
                        nodeRelSize={8}
                        nodeColor={(node) => {
                          if (highlightNodes.size === 0) return '#3b82f6'; 
                          
                          const isHigh = Array.from(highlightNodes).some(f => 
                             (node.id && typeof node.id === 'string' && node.id.includes(f)) || 
                             (node.name && typeof node.name === 'string' && node.name.includes(f))
                          );
                          return isHigh ? '#ef4444' : (isDarkMode ? '#334155' : '#cbd5e1'); 
                        }}
                        linkColor={(link) => {
                          if (highlightNodes.size === 0) return isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
                          
                          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                          
                          const sHigh = sourceId && typeof sourceId === 'string' && Array.from(highlightNodes).some(f => sourceId.includes(f));
                          const tHigh = targetId && typeof targetId === 'string' && Array.from(highlightNodes).some(f => targetId.includes(f));
                          
                          return sHigh || tHigh ? "rgba(239, 68, 68, 0.6)" : "rgba(0,0,0,0.05)";
                        }}
                      />
                    </Card>
                  )}
                </Box>
              )}

            </Box>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;