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
// Imported new icons for Dark Mode and Fullscreen
import { 
  GitHub, Terminal, Timeline, Description, Share, Download, 
  Chat as ChatIcon, Send, LightMode, DarkMode, Fullscreen, FullscreenExit 
} from '@mui/icons-material';

function App() {
  const [url, setUrl] = useState('');
  const [repoName, setRepoName] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState('report');
  
  // Chatbot states
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // 🔥 NEW: UI Toggle States
  const [isDarkMode, setIsDarkMode] = useState(true); // Dark is default
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mounted = useRef(true);
  const chatEndRef = useRef(null);

  // 🔥 NEW: Dynamic Theme Generation
  const theme = useMemo(() => createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
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
    if (!mounted.current) return;
    setReport(r.data.content);
    setGraph(g.data);
    setChatHistory([{ role: 'bot', text: `Hello! I am AURA. You can ask me anything about the **${name}** codebase.` }]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatting(true);

    try {
      const res = await axios.post('http://localhost:8000/api/chat', {
        repo_name: repoName,
        question: userMessage
      });
      setChatHistory(prev => [...prev, { role: 'bot', text: res.data.answer }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "⚠️ Error connecting to the AURA Agent. Make sure the backend is running." }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* PERFECT PDF PRINT STYLES */}
      <GlobalStyles styles={{
        '@media print': {
          '.no-print': { display: 'none !important' },
          'html, body, #root': {
            display: 'block !important', height: 'auto !important', minHeight: 'auto !important',
            overflow: 'visible !important', position: 'static !important', margin: '0 !important',
            padding: '0 !important', backgroundColor: 'white !important',
          },
          'pre': {
            whiteSpace: 'pre-wrap !important', wordWrap: 'break-word !important',
            wordBreak: 'break-word !important', pageBreakInside: 'auto !important',
            backgroundColor: '#f8fafc !important', border: '1px solid #e2e8f0 !important',
            color: 'black !important', padding: '12px !important',
          },
          'code': {
            whiteSpace: 'pre-wrap !important', wordWrap: 'break-word !important',
            color: 'black !important', fontFamily: 'monospace !important', fontSize: '10pt !important',
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
        
        {/* Hide Appbar in Fullscreen and Print */}
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
              
              {/* 🔥 NEW: Theme Toggle Button */}
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
                  <MenuItem value=""><em>Memory_Logs</em></MenuItem>
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
            
            {/* Hide Tabs in Fullscreen and Print */}
            {!isFullscreen && (
              <Box sx={{ 
                borderBottom: 1, borderColor: 'divider', px: 5,
                '@media print': { display: 'none !important' } 
              }}>
                <Tabs value={page} onChange={(e, newValue) => setPage(newValue)} sx={{ pt: 3 }}>
                  <Tab value="report" icon={<Description />} label="Project Document" iconPosition="start" />
                  <Tab value="graph" icon={<Share />} label="Dependency Graph" iconPosition="start" />
                  <Tab value="chat" icon={<ChatIcon />} label="Ask AURA" iconPosition="start" />
                </Tabs>
              </Box>
            )}

            <Box sx={{ 
              flex: 1, overflow: 'auto', p: isFullscreen ? 0 : 5,
              '@media print': { display: 'block !important', overflow: 'visible !important', p: 0, m: 0 }
            }}>
              
              {/* TAB 1: Document */}
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
                        {/* 🔥 NEW: Fullscreen Toggle for Document */}
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
                      
                      {/* 🔥 NEW: Dynamic Colors based on Dark/Light Mode */}
                      <Box className="prose-container" sx={{ 
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        '& h1': { color: 'text.primary', fontSize: '2.5rem', fontWeight: 900, mt: 6, mb: 3, pb: 1, borderBottom: 1, borderColor: 'divider' }, 
                        '& h2': { color: isDarkMode ? '#60a5fa' : '#1d4ed8', fontSize: '1.8rem', fontWeight: 700, mt: 5, mb: 2 }, 
                        '& h3': { color: isDarkMode ? '#93c5fd' : '#2563eb', fontSize: '1.4rem', fontWeight: 600, mt: 4, mb: 1.5 }, 
                        '& p': { color: 'text.secondary', fontSize: '1.15rem', lineHeight: 1.8, mb: 3 }, 
                        '& strong': { color: 'text.primary', fontWeight: 700 }, 
                        '& li': { color: 'text.secondary', fontSize: '1.15rem', lineHeight: 1.8, mb: 1 },
                        '& pre': { bgcolor: isDarkMode ? '#0f172a' : '#f8fafc', p: 3, borderRadius: 2, mb: 4, border: 1, borderColor: 'divider', overflowX: 'auto' },
                        '& code': { color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontFamily: 'monospace' },
                        '& img': { maxWidth: '100%', borderRadius: '8px', mt: 2, mb: 4 },
                        '@media print': {
                          color: 'black !important', '& *': { color: 'black !important' },
                          '& h1': { fontSize: '24pt', borderBottom: '2px solid black', mt: 0, pt: 2, mb: 2 },
                          '& h2': { color: '#1a365d !important', fontSize: '18pt', mt: 4, mb: 2, pageBreakAfter: 'avoid' },
                          '& h3': { color: '#2563eb !important', fontSize: '14pt', mt: 3, mb: 1, pageBreakAfter: 'avoid' },
                          '& p': { fontSize: '11pt', lineHeight: 1.6, pageBreakInside: 'avoid' },
                          '& li': { fontSize: '11pt', mb: 1 },
                        }
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                      </Box>
                    </Box>
                  </Card>
                </Container>
              )}

              {/* TAB 2: Graph */}
              {page === 'graph' && (
                <Card className="no-print" sx={{ position: 'relative', height: '100%', bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'background.paper', border: 1, borderColor: 'divider', borderRadius: isFullscreen ? 0 : 4, overflow: 'hidden' }}>
                  {/* 🔥 NEW: Fullscreen Toggle for Graph */}
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

              {/* TAB 3: Chat Agent */}
              {page === 'chat' && (
                <Container maxWidth={isFullscreen ? false : "md"} sx={{ height: '100%' }}>
                  <Card className="no-print" sx={{ 
                    height: '100%', display: 'flex', flexDirection: 'column', 
                    bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: isFullscreen ? 0 : 4, overflow: 'hidden' 
                  }}>
                    <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: isDarkMode ? '#0f172a' : '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        <Terminal sx={{ mr: 1, color: 'primary.main' }} /> Ask AURA about {repoName}
                      </Typography>
                      {/* 🔥 NEW: Fullscreen Toggle for Chat */}
                      <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        <IconButton onClick={() => setIsFullscreen(!isFullscreen)} color="primary">
                          {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Box sx={{ flex: 1, p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {chatHistory.map((msg, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <Box sx={{ 
                            maxWidth: isFullscreen ? '60%' : '80%', p: 2, borderRadius: 2,
                            // Dynamic chat bubble colors
                            bgcolor: msg.role === 'user' ? 'primary.main' : (isDarkMode ? '#1e293b' : '#f8fafc'), 
                            color: msg.role === 'user' ? '#ffffff' : 'text.primary',
                            border: msg.role !== 'user' && !isDarkMode ? '1px solid rgba(0,0,0,0.1)' : 'none',
                            '& pre': { bgcolor: isDarkMode ? '#0f172a' : '#e2e8f0', p: 2, borderRadius: 2, overflowX: 'auto', mt: 1 },
                            '& code': { fontFamily: 'monospace', color: msg.role === 'user' ? '#ffffff' : (isDarkMode ? '#93c5fd' : '#1d4ed8') }
                          }}>
                            {msg.role === 'user' ? (<Typography>{msg.text}</Typography>) : (<ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>)}
                          </Box>
                        </Box>
                      ))}
                      {isChatting && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDarkMode ? '#1e293b' : '#f8fafc', color: 'text.secondary', border: !isDarkMode ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
                            <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> Scanning Codebase...
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
                </Container>
              )}

            </Box>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;