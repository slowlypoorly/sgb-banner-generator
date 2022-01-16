import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import { Connection, clusterApiUrl, PublicKey, RpcResponseAndContext, ParsedAccountData, AccountInfo } from '@solana/web3.js';

import { Metadata } from '@metaplex-foundation/mpl-token-metadata';

import pThrottle from 'p-throttle';

type TokenData = {
    pubkey: PublicKey;
    account: AccountInfo<ParsedAccountData>;
};

const wallet = async function(req, res) {
  // Connect to cluster
  const connection = new Connection(
    clusterApiUrl('mainnet-beta'),
    'confirmed',
  );
  
  const throttle = pThrottle({
    limit: 2,
    interval: 500
  });

  // Generate a new wallet keypair and airdrop SOL
  let ownerAccountPublicKey;
  let mintPublicKey;
  let account;
  let tokens: RpcResponseAndContext<TokenData[]>;
  
  try {
    ownerAccountPublicKey = new PublicKey('8DaNJcxENMoSYDgpec1xWw1VoUs475LUKSXR47oWmWRi');
  } catch(error) {
    console.error('Error getting ownerAccountPublicKey', error);
    res.json({ result: 'error getting ownerAccountPublicKey' });
  }

  try {
    mintPublicKey = new PublicKey('2Usu2LPwaosyDTKfVXTX5cNgcW1S9HrCzVVv9HUzreNZ');
  } catch(error) {
    console.error('Error getting mintPublicKey', error);
    res.json({ result: 'error getting mintPublicKey' });
  }

  try {
    account = await connection.getAccountInfoAndContext(ownerAccountPublicKey);
  } catch(error) {
    console.error('Error getting account info', error);
    res.json({ result: 'error getting account info' });
    return;
  }
  
  try {
    tokens = await connection.getParsedTokenAccountsByOwner(ownerAccountPublicKey, {
      programId: TOKEN_PROGRAM_ID,
    });
  } catch(error) {
    console.error('Error getting token accounts', error);
    res.json({ result: 'error getting token accounts' });
    return;
  }
  
  let sgbTokens = [];
  
  const getTokenFromCollection = throttle(async (token: TokenData) => {
    const tokenData = token.account.data.parsed;
    
    let metadataPDA;
    let tokenMetadata;
  
    try {
      metadataPDA = await Metadata.getPDA(new PublicKey(tokenData.info.mint));  
    } catch(e) {
      console.error('error getting metadata PDA:' + e);
    }
    
    try {
      tokenMetadata = await Metadata.load(connection, metadataPDA);
      console.log('tokenMetadata', tokenMetadata.data);
      if (tokenMetadata.data.data.symbol === 'SGB') {
        sgbTokens.push(tokenMetadata.data.data.uri);
      }
    } catch(e) {
      console.error('error getting token metadata:' + e);
    }
  });
  
  await Promise.all(tokens.value.map(async token => {
    await getTokenFromCollection(token);
  }));

  res.json({ token: sgbTokens });
};

module.exports = wallet;
