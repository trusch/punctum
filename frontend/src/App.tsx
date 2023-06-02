import React, { useEffect, useState } from "react";
import Web3 from 'web3';
import { AppBar, Button, Container, Grid, IconButton, Paper, Stack, TextField, Toolbar, Typography } from "@mui/material";
import { ethers } from "ethers";
import { BrowserProvider, Eip1193Provider } from "ethers/types/providers";
import MenuIcon from '@mui/icons-material/Menu';

import logo from './logo.svg';
import './App.css';
import ContractABI from './Punctum.json';

declare global {
  interface Window {
    ethereum: Eip1193Provider & BrowserProvider;
  }
}

function App() {
  return (
    <Container sx={{p: '5vh'}}>
      <MetaConnect />
    </Container>
  );
}


const MetaConnect = () => {

  // check if "admin" is part of the search params
  const isAdmin = window.location.search.includes('admin');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [contract, setContract] = useState<any>(null);
  const [auctionState, setAuctionState] = useState<any>(null);
  const [currentBlock, setCurrentBlock] = useState<number|null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [auctionEnded, setAuctionEnded] = useState<boolean>(false);
  const [auctionStarted, setAuctionStarted] = useState<boolean>(false);
  const [auctionStatus, setAuctionStatus] = useState<string>('Not Started');
  const [tokenURI, setTokenURI] = useState<string>('');

  useEffect(() => {
    if (contract) {
      console.log('get auction state')
      const fn = async () => {
        let resp = await contract.methods.auctionState().call();
        setAuctionState(resp);
      };
      setInterval(fn, 1000);
    }
  }, [contract]);

  useEffect(() => {
    if (auctionState && currentBlock) {
      let auctionEnd = parseInt(auctionState['3']);
      if (auctionEnd===0) {
        setAuctionEnded(false);
        setAuctionStarted(false);
        setAuctionStatus('Not Started');
      }
      if (auctionEnd>0 && auctionEnd<currentBlock) {
        setAuctionEnded(true);
        setAuctionStarted(false);
        setAuctionStatus('Ended');
      }
      if (auctionEnd>0 && auctionEnd>currentBlock) {
        setAuctionEnded(false);
        setAuctionStarted(true);
        setAuctionStatus('Ends in '+(auctionEnd-currentBlock)+' blocks');
      }
    }
  }, [currentBlock, auctionState])

  useEffect(() => {
    const fn = async () => {
      const nextToken = auctionState && parseInt(auctionState['0']);
      if (nextToken && contract) {
        const tokenURI = await contract.methods.tokenURI(nextToken).call();
        setTokenURI(tokenURI);
      }
    };
    fn();
  }, [auctionState, contract]);

  useEffect(() => {
    if (tokenURI) {
      console.log('tokenURI', tokenURI)
    }
  }, [tokenURI])

  useEffect(() => {
    if (web3) {
      const nftContract = new web3.eth.Contract(ContractABI.abi as any, "0xDe03ea558c9dF9eE7f09c2D69C085baB2044C1Ab", {
        from: account || undefined,
        gas: 3000000,
      })
      setContract(nftContract);  
    }
  }, [web3, account]);

  useEffect(() => {
    if (auctionState && auctionState['3']>0 && auctionState['3'] <(currentBlock||0)) {
      setAuctionEnded(true);
    }
  }, [auctionState, currentBlock]);

  const connectHandler = async () => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", accountsChanged);
      window.ethereum.on("chainChanged", chainChanged);
      try {
        const res = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        await accountsChanged(res[0]);
      } catch (err) {
        console.error(err);
        setErrorMessage("There was a problem connecting to MetaMask");
      }
    } else {
      setErrorMessage("Install MetaMask");
    }
  };

  const accountsChanged = async (newAccount: string) => {
    setAccount(newAccount);
    try {
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [newAccount.toString(), "latest"],
      });
      setBalance(ethers.formatEther(balance));
      if (!web3) {
        const web3 = new Web3(window.ethereum as any);
        setWeb3(web3);
      }

      if (!currentBlock) {
        setInterval(async () => {
          const currentBlock = await window.ethereum.request({
            method: "eth_blockNumber",
          });
          console.log('currentBlock', currentBlock);
          setCurrentBlock(parseInt(currentBlock));
        }, 6000);
      }


    } catch (err) {
      console.error(err);
      setErrorMessage("There was a problem connecting to MetaMask");
    }
  };

  const chainChanged = async () => {
    await connectHandler();
  };

  const bidHandler = () => {
    if (contract) {
      const fn = async () => {
        await contract.methods.bid().send({
          from: account,
          value: 1_000_000_000_000_000_000 * bidAmount,
        });
        let resp = await contract.methods.auctionState().call();
        setAuctionState(resp);
      };
      fn();
    }
  };

  const settleHandler = () => {
    console.log('settle auction', contract)
    if (contract) {
      const fn = async () => {
        await contract.methods.closeAuction().send();
      };
      fn();
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <AppBar position="static">
        <Toolbar>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Punctum
            </Typography>
            {account ? 
              <Typography variant="h6">{account.substring(0, 10)}...</Typography> : 
              <Button color="inherit" onClick={connectHandler} >Connect</Button>
            }
            </Toolbar>
      </AppBar>
      <Stack spacing={2}>
        
        <Typography variant="h6">
          Current Block: {currentBlock}
        </Typography>
        <Typography variant="h6">
          Balance: {balance} {balance ? "SAMA" : null}
        </Typography>
        {auctionStarted ? (
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField type="number" fullWidth label="amount" id="outlined-basic" variant="outlined" value={bidAmount} onChange={(e)=>{setBidAmount(parseInt(e.target.value))}}  />
            </Grid>
            <Grid item xs={4}>
              <Button fullWidth variant="outlined" onClick={bidHandler}>Bid</Button>
            </Grid>
          </Grid>
        ): auctionEnded ? (
          <Button fullWidth variant="outlined" onClick={settleHandler}>Settle Auction</Button>
        ): null}
        
        {errorMessage ? (
          <Typography variant="body1" color="red">
            Error: {errorMessage}
          </Typography>
        ) : null}
        <Typography variant="h6">
          Next Token: #{auctionState && auctionState['0']}
        </Typography>
        <Typography variant="h6">          
          Highest Bidder: {auctionState && auctionState['1']}
        </Typography>
        <Typography variant="h6">
          Highest Bid: {auctionState && auctionState['2']}
        </Typography>
        <Typography variant="h6">
          Auction Status: {auctionStatus}
        </Typography>
        {isAdmin ? (
          <AdminPanel contract={contract} account={account} web3={web3} />
        ) : null}
      </Stack>
    </Paper>
  );
};

type AdminPanelProps = {
  contract: any;
  account: string | null;
  web3: Web3 | null;
};

// AdminPanel allows calling the startNextAuction function on the contract
// it takes an ipfs uri and a duration and starts the next auction
function AdminPanel(props: AdminPanelProps) {
  const { contract, account, web3 } = props;
  const [tokenURI, setTokenURI] = useState("");
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const startAuctionHandler = () => {
    const fn = async () => {
      console.log(contract);
      if (contract) {
        try {
          await contract.methods.startNextAuction(tokenURI, duration).send({
            from: account,
          });
        } catch(e: any) {
          setErrorMessage(e.message);
        }
      }      
    };
    fn();
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">
          Admin Panel
        </Typography>
        <TextField fullWidth label="tokenURI" id="outlined-basic" variant="outlined" value={tokenURI} onChange={(e)=>{setTokenURI(e.target.value)}}  />
        <TextField fullWidth label="duration" id="outlined-basic" variant="outlined" value={duration} onChange={(e)=>{setDuration(parseInt(e.target.value))}}  />
        <Button fullWidth variant="outlined" onClick={startAuctionHandler}>Start Auction</Button>
        {errorMessage ? (
          <Typography variant="body1" color="red">
            Error: {errorMessage}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default App;
