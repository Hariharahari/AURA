import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReactDiffViewer from 'react-diff-viewer-continued';
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
  Campaign, AccountTree, Assignment 
} from '@mui/icons-material';

function App() {
  const [url, setUrl] = useState('');
  const [repoName, setRepoName] = useState('');
  const [docType, setDocType] = useState('both');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const [techReport, setTechReport] = useState('');
  const [bizReport, setBizReport] = useState('');
  const [notes, setNotes] = useState('');
  
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [history, setHistory] = useState([]);
  
  const [page, setPage] = useState('notes'); 
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [hoverNode, setHoverNode] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mounted = useRef(true);
  const chatEndRef = useRef(null);
  const fgRef = useRef(null);

  const theme = useMemo(() => createTheme({
    typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: { main: '#1976d2' },
      background: {
        default: isDarkMode ? '#02040a' : '#f1f5f9',
        paper: isDarkMode ? '#0d1117' : '#ffffff',
      },
    },
  }), [isDarkMode]);

  const graphNeighbors = useMemo(() => {
    const neighbors = new Map();
    if (!graph || !graph.links) return neighbors;
    graph.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? String(link.source.id) : String(link.source);
      const targetId = typeof link.target === 'object' ? String(link.target.id) : String(link.target);
      if (!neighbors.has(sourceId)) neighbors.set(sourceId, new Set());
      if (!neighbors.has(targetId)) neighbors.set(targetId, new Set());
      neighbors.get(sourceId).add(targetId);
      neighbors.get(targetId).add(sourceId);
    });
    return neighbors;
  }, [graph]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    mounted.current = true;
    fetchHistory();
    return () => (mounted.current = false);
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      const messages = [
        "Cloning repository...",
        "Mapping AST dependencies in Neo4j...",
        "Vectorizing code into FAISS Database...",
        "Consulting AURA AI Agents...",
        "Drafting architectural chapters...",
        "Visualizing the network graph...",
        "Applying finishing touches..."
      ];
      let i = 0;
      setLoadingMessage(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 6000); 
    } else {
      setLoadingMessage('');
    }
    return () => clearInterval(interval);
  }, [loading]);

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
      const res = await axios.post('http://localhost:8000/api/analyze', { url, doc_type: docType });
      setRepoName(res.data.repo_name);
      await load(res.data.repo_name);
      fetchHistory();
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const downloadPDF = () => window.print();

  const load = async (name) => {
    try {
        const tr = await axios.get(`http://localhost:8000/api/reports/technical/${name}`);
        setTechReport(tr.data.content);
    } catch (e) {
        setTechReport("⚠️ Technical Audit not generated for this repository. Select 'Technical' or 'Both' and re-analyze.");
    }
    
    try {
        const br = await axios.get(`http://localhost:8000/api/reports/business/${name}`);
        setBizReport(br.data.content);
    } catch (e) {
        setBizReport("⚠️ Business Strategy not generated for this repository. Select 'Business' or 'Both' and re-analyze.");
    }
    
    try {
        const n = await axios.get(`http://localhost:8000/api/notes/${name}`);
        setNotes(n.data.content);
    } catch (e) {
        setNotes("Release notes not found.");
    }

    try {
        const g = await axios.get(`http://localhost:8000/api/graph/${name}`);
        setGraph(g.data);
    } catch (e) {
        setGraph({ nodes: [], links: [] });
    }

    if (!mounted.current) return;
    
    setHighlightNodes(new Set());
    setChatHistory([{ role: 'bot', text: `Hello! I am AURA. You can ask me anything about the **${name}** codebase.` }]);
    setPage('notes'); 
  };

  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
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
        body: JSON.stringify({ repo_name: repoName, question: userMessage })
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
          const impactMatch = accumulatedAnswer.match(/<AFFECTED_FILES>([\s\S]*?)<\/AFFECTED_FILES>/i);

          if ((graphMatch || impactMatch) && !graphTriggered) {
            const rawFiles = graphMatch ? graphMatch[1] : impactMatch[1];
            
            const files = rawFiles
                .replace(/\r?\n|\r/g, '')
                .split(',')
                .map(f => f.trim().replace(/\\/g, '/').toLowerCase())
                .filter(f => f.length > 0);

            setHighlightNodes(new Set(files));
            setShowGraphPanel(true);
            
            setTimeout(() => {
                if (fgRef.current) fgRef.current.d3ReheatSimulation();
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

  // 🔥 FIX 1: Cleaned up formatCode so it preserves proper LLM line breaks!
  const formatCode = (codeStr) => {
    if (!codeStr) return '';
    let cleaned = codeStr.trim();
    // Remove Markdown wrappers if the LLM added them inside the XML tag
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/gm, '');
    cleaned = cleaned.replace(/```$/gm, '');
    return cleaned.trim();
  };

  // 🔥 FIX 2: A robust extractor that grabs text even if the LLM is still streaming and missing the closing tag
  const extractTag = (text, tag) => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)(?:<\\/${tag}>|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const getGraphProps = () => ({
    nodeColor: (node) => {
      const nodeIdRaw = String(node.id || '');
      const nodeIdLow = nodeIdRaw.replace(/\\/g, '/').toLowerCase();
      const nodeNameLow = String(node.name || '').toLowerCase();
      
      const isTarget = Array.from(highlightNodes).some(f => nodeIdLow === f || nodeIdLow.endsWith('/' + f) || nodeNameLow === f);
      const isHovered = hoverNode && hoverNode.id === node.id;
      const isNeighbor = hoverNode && graphNeighbors.get(hoverNode.id)?.has(nodeIdRaw);

      if (isHovered) return '#f59e0b';
      if (isNeighbor) return '#fbbf24';
      if (isTarget) return '#ef4444'; 
      
      if (highlightNodes.size > 0 || hoverNode) return isDarkMode ? '#1e293b' : '#e2e8f0';
      return isDarkMode ? '#334155' : '#cbd5e1';
    },
    linkColor: (link) => {
      const sourceIdRaw = typeof link.source === 'object' ? link.source.id : link.source;
      const targetIdRaw = typeof link.target === 'object' ? link.target.id : link.target;
      const sourceIdLow = String(sourceIdRaw || '').replace(/\\/g, '/').toLowerCase();
      const targetIdLow = String(targetIdRaw || '').replace(/\\/g, '/').toLowerCase();
      
      const isHoverLink = hoverNode && (sourceIdRaw === hoverNode.id || targetIdRaw === hoverNode.id);
      const sHigh = Array.from(highlightNodes).some(f => sourceIdLow === f || sourceIdLow.endsWith('/' + f));
      const tHigh = Array.from(highlightNodes).some(f => targetIdLow === f || targetIdLow.endsWith('/' + f));
      const isTargetLink = sHigh || tHigh;

      if (isHoverLink) return '#f59e0b';
      if (isTargetLink) return "rgba(239, 68, 68, 0.6)";

      if (highlightNodes.size > 0 || hoverNode) return isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
      return isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
    },
    nodeCanvasObjectMode: () => 'after',
    nodeCanvasObject: (node, ctx, globalScale) => {
      const nodeIdRaw = String(node.id || '');
      const nodeIdLow = nodeIdRaw.replace(/\\/g, '/').toLowerCase();
      const nodeNameLow = String(node.name || '').toLowerCase();
      
      const isTarget = Array.from(highlightNodes).some(f => nodeIdLow === f || nodeIdLow.endsWith('/' + f) || nodeNameLow === f);
      const isHovered = hoverNode && hoverNode.id === node.id;
      const isNeighbor = hoverNode && graphNeighbors.get(hoverNode.id)?.has(nodeIdRaw);

      if (isHovered || isNeighbor || isTarget) {
        const label = String(node.name || node.id).split('/').pop(); 
        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        
        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

        ctx.fillStyle = isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + 8 - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isTarget) ctx.fillStyle = '#ef4444';
        else if (isHovered) ctx.fillStyle = '#f59e0b';
        else if (isNeighbor) ctx.fillStyle = '#fbbf24';
        else ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#1e293b';
        
        ctx.fillText(label, node.x, node.y + 8);
      }
    },
    onNodeHover: setHoverNode
  });

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
          '.prose-container p, .prose-container li, .prose-container strong, .prose-container span': { color: 'black !important' },
          '.prose-container h1': { color: 'black !important', borderBottomColor: '#ccc !important' },
          '.prose-container h2': { color: '#1d4ed8 !important' },
          '.prose-container h3': { color: '#2563eb !important' },
          '.notes-container h1': { color: 'black !important', borderBottomColor: '#ccc !important' },
          '.notes-container h2': { color: '#16a34a !important' },
          '.notes-container h3': { color: '#22c55e !important' },
          'pre': {
            whiteSpace: 'pre !important', wordWrap: 'break-word !important',
            wordBreak: 'break-word !important', pageBreakInside: 'auto !important',
            backgroundColor: '#f8fafc !important', border: '1px solid #e2e8f0 !important',
            color: 'black !important', padding: '12px !important',
            fontFamily: 'Consolas, "Courier New", monospace !important',
          },
          'code': {
            whiteSpace: 'pre !important', wordWrap: 'break-word !important',
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
                  onChange={(e) => { setRepoName(e.target.value); load(e.target.value); setPage('notes'); setIsFullscreen(false); }}
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
                  
                  <FormControl variant="standard" sx={{ minWidth: 200, ml: 2, mr: 2 }}>
                    <Select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      disableUnderline
                      sx={{ color: 'text.primary', fontWeight: 'bold' }}
                    >
                      <MenuItem value="both">Both (Comprehensive)</MenuItem>
                      <MenuItem value="technical">Technical Audit Only</MenuItem>
                      <MenuItem value="business">Business Strategy Only</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    type="submit" disabled={loading} variant="contained"
                    sx={{ px: 5, py: 3, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {loading ? 'Processing...' : 'Initiate Analysis'}
                  </Button>
                </Box>
              </form>
            </Card>
            
            {loading && (
              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ 
                  color: 'primary.main', 
                  fontWeight: 'bold', 
                  letterSpacing: '0.05em',
                  animation: 'pulse 1.5s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 0.6 },
                    '50%': { opacity: 1 },
                    '100%': { opacity: 0.6 },
                  }
                }}>
                  {loadingMessage}
                </Typography>
              </Box>
            )}
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
                  <Tab value="notes" icon={<Campaign />} label="Release Notes" iconPosition="start" />
                  <Tab value="biz" icon={<Assignment />} label="Business Strategy" iconPosition="start" />
                  <Tab value="tech" icon={<Description />} label="Technical Audit" iconPosition="start" />
                  <Tab value="graph" icon={<Share />} label="Dependency Graph" iconPosition="start" />
                  <Tab value="chat" icon={<ChatIcon />} label="Ask AURA" iconPosition="start" />
                </Tabs>
              </Box>
            )}

            <Box sx={{ 
              flex: 1, overflow: 'auto', p: isFullscreen ? 0 : 5,
              '@media print': { display: 'block !important', overflow: 'visible !important', p: 0, m: 0 }
            }}>
              
              {/* RELEASE NOTES TAB */}
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

              {/* BUSINESS STRATEGY TAB */}
              {page === 'biz' && (
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
                      <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Enterprise Business Strategy</Typography>
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{bizReport}</ReactMarkdown>
                      </Box>
                    </Box>
                  </Card>
                </Container>
              )}

              {/* TECHNICAL AUDIT TAB */}
              {page === 'tech' && (
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
                      <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 'bold' }}>Technical Architecture Audit</Typography>
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{techReport}</ReactMarkdown>
                      </Box>
                    </Box>
                  </Card>
                </Container>
              )}

              {/* GRAPH TAB */}
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
                    nodeRelSize={10} 
                    {...getGraphProps()}
                  />
                </Card>
              )}

              {/* CHAT TAB */}
              {page === 'chat' && (
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, height: '100%' }}>
                  
                  {/* LEFT SIDE: Chat Interface */}
                  <Card className="no-print" sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: isFullscreen ? 0 : 4, overflow: 'hidden' }}>
                    <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: isDarkMode ? '#0f172a' : '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        <Terminal sx={{ mr: 1, color: 'primary.main' }} /> Ask AURA
                      </Typography>
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
                        const isImpactAnalysis = msg.role !== 'user' && displayText.includes('<IMPACT_ANALYSIS>');
                        let messageContent;

                        if (isImpactAnalysis) {
                          // 🔥 FIX 3: Safe, streaming-friendly XML parsing regexes
                          const riskLevel = extractTag(displayText, 'RISK_LEVEL') || 'ANALYZING...';
                          const affectedFiles = extractTag(displayText, 'AFFECTED_FILES');
                          const systemImpact = extractTag(displayText, 'SYSTEM_IMPACT');
                          const techImpact = extractTag(displayText, 'TECHNICAL_IMPACT');
                          const userImpact = extractTag(displayText, 'USER_IMPACT');
                          const suggestion = extractTag(displayText, 'SUGGESTION');
                          
                          const originalCode = formatCode(extractTag(displayText, 'ORIGINAL_CODE'));
                          const safeCode = formatCode(extractTag(displayText, 'SAFE_CODE'));

                          // Capture any extra text the AI outputs outside the XML tags
                          const preText = displayText.split('<IMPACT_ANALYSIS>')[0].trim();
                          const postTextMatch = displayText.match(/<\/IMPACT_ANALYSIS>([\s\S]*)$/i);
                          const postText = postTextMatch ? postTextMatch[1].trim() : '';

                          const blastRadiusValue = affectedFiles && affectedFiles.trim() !== '' ? affectedFiles.split(',').length : 0;
                          const isLowRisk = riskLevel.toUpperCase().includes('LOW') || riskLevel.toUpperCase().includes('SAFE');
                          const isMediumRisk = riskLevel.toUpperCase().includes('MEDIUM');

                          let uiColor = 'error.main'; // Default Red
                          let bgColor = isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2';
                          let shadowColor = 'rgba(239, 68, 68, 0.5)';
                          let icon = '⚠️';

                          if (isLowRisk) {
                              uiColor = 'success.main'; // Green
                              bgColor = isDarkMode ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4';
                              shadowColor = 'rgba(34, 197, 94, 0.5)';
                              icon = '✅';
                          } else if (isMediumRisk) {
                              uiColor = 'warning.main'; // Orange
                              bgColor = isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb';
                              shadowColor = 'rgba(245, 158, 11, 0.5)';
                              icon = '⚡';
                          }

                          messageContent = (
                            <Box sx={{ width: '100%', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
                              
                              {/* Render pre-text safely */}
                              {preText && (
                                <Box sx={{ mb: 2, color: 'text.primary' }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{preText}</ReactMarkdown>
                                </Box>
                              )}

                              <Box sx={{ border: '2px solid', borderColor: uiColor, bgcolor: bgColor, p: 3, borderRadius: 2 }}>
                                <Typography variant="h6" sx={{ color: uiColor, fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                                  {icon} {riskLevel.trim()} RISK: ARCHITECTURE IMPACT DETECTED
                                </Typography>
                                
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                  <Box sx={{ 
                                    bgcolor: uiColor, color: 'white', px: 2, py: 1, 
                                    borderRadius: 1, fontWeight: 'bold', fontSize: '1.1rem',
                                    boxShadow: `0 0 10px ${shadowColor}`
                                  }}>
                                    💥 Blast Radius: {blastRadiusValue} Modules
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>Affected Files: </Typography>
                                    <Typography component="span" sx={{ color: 'text.secondary' }}>{affectedFiles || 'Analyzing...'}</Typography>
                                  </Box>
                                </Box>

                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
                                  <Card sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                                    <Typography sx={{ color: '#1d4ed8', fontWeight: 'bold', mb: 1 }}>👨‍💻 Technical Impact</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{techImpact || '...'}</Typography>
                                  </Card>
                                  <Card sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                                    <Typography sx={{ color: '#059669', fontWeight: 'bold', mb: 1 }}>🌍 System Impact</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{systemImpact || '...'}</Typography>
                                  </Card>
                                  <Card sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                                    <Typography sx={{ color: '#9333ea', fontWeight: 'bold', mb: 1 }}>👔 End-User Impact</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{userImpact || '...'}</Typography>
                                  </Card>
                                </Box>

                                {suggestion && (
                                  <Box sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4', border: '1px solid', borderColor: 'success.main', borderRadius: 1, mb: 3 }}>
                                    <Typography component="span" sx={{ fontWeight: 'bold', color: 'success.main' }}>💡 AURA Suggestion: </Typography>
                                    <Typography component="span" sx={{ color: 'text.primary' }}>{suggestion}</Typography>
                                  </Box>
                                )}

                                {originalCode && safeCode && (
                                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflowX: 'auto', width: '100%', mt: 2 }}>
                                    <Box sx={{ minWidth: '100%', width: 'max-content' }}>
                                      <Box sx={{ p: 1.5, bgcolor: isDarkMode ? '#1e293b' : '#e2e8f0', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: uiColor, width: '50%' }}>User Proposed Code</Typography>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'success.main', width: '50%' }}>AURA Implementation</Typography>
                                      </Box>
                                      <ReactDiffViewer
                                        oldValue={originalCode}
                                        newValue={safeCode}
                                        splitView={true}
                                        useDarkTheme={isDarkMode}
                                        hideLineNumbers={false}
                                        styles={{
                                          variables: {
                                            dark: { diffViewerBackground: '#0d1117', addedBackground: 'rgba(34, 197, 94, 0.2)', removedBackground: 'rgba(239, 68, 68, 0.2)' },
                                            light: { diffViewerBackground: '#ffffff', addedBackground: '#dcfce7', removedBackground: '#fee2e2' }
                                          },
                                          diffContainer: { tableLayout: 'auto !important' },
                                          contentText: { whiteSpace: 'pre !important', fontFamily: 'Consolas, "Courier New", monospace !important', fontSize: '13px' }
                                        }}
                                      />
                                    </Box>
                                  </Box>
                                )}
                              </Box>

                              {/* Render post-text safely */}
                              {postText && (
                                <Box sx={{ mt: 2, color: 'text.primary' }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{postText}</ReactMarkdown>
                                </Box>
                              )}

                            </Box>
                          );
                        } else {
                          messageContent = msg.role === 'user' 
                            ? <Typography sx={{ whiteSpace: 'pre-wrap' }}>{displayText}</Typography> 
                            : <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>;
                        }

                        return (
                          <Box key={index} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
                            <Box sx={{ 
                              maxWidth: isImpactAnalysis ? '100%' : '85%', p: isImpactAnalysis ? 0 : 2, borderRadius: 2,
                              bgcolor: msg.role === 'user' ? 'primary.main' : (isImpactAnalysis ? 'transparent' : (isDarkMode ? '#1e293b' : '#f8fafc')), 
                              color: msg.role === 'user' ? '#ffffff' : 'text.primary',
                              border: msg.role !== 'user' && !isDarkMode && !isImpactAnalysis ? '1px solid rgba(0,0,0,0.1)' : 'none',
                              '& pre': { bgcolor: isDarkMode ? '#0f172a' : '#e2e8f0', p: 2, borderRadius: 2, overflowX: 'auto', mt: 1, fontFamily: 'Consolas, "Courier New", monospace' },
                              '& code': { fontFamily: 'Consolas, "Courier New", monospace', color: msg.role === 'user' ? '#ffffff' : (isDarkMode ? '#93c5fd' : '#1d4ed8') }
                            }}>
                              {messageContent}
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
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField 
                          fullWidth 
                          variant="outlined" 
                          placeholder={`Ask a question about ${repoName}...\n(Shift+Enter for new line)`}
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.target.value)} 
                          disabled={isChatting}
                          multiline={true} 
                          maxRows={6}
                          sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#ffffff' } }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                        />
                        <Button 
                          onClick={handleSendMessage} 
                          variant="contained" 
                          disabled={isChatting || !chatInput.trim()} 
                          sx={{ px: 3, height: '56px', alignSelf: 'flex-end' }}
                        >
                          <Send />
                        </Button>
                      </Box>
                    </Box>
                  </Card>

                  {/* RIGHT SIDE: Interactive Graph View */}
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
                        {...getGraphProps()} 
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