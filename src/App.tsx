/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Trophy, AlertCircle, ChevronRight, Info } from 'lucide-react';
import { Card, Suit, Rank, GameStatus, GameState } from './types';
import { createDeck, shuffle, isPlayable, getSuitSymbol, getSuitColor, SUITS } from './constants';

const CARD_WIDTH = 80;
const CARD_HEIGHT = 120;

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    deck: [],
    playerHand: [],
    aiHand: [],
    discardPile: [],
    currentSuit: 'hearts',
    currentRank: 'A',
    turn: 'player',
    status: 'waiting',
    winner: null,
  });

  const [message, setMessage] = useState<string>("欢迎来到 Tina 疯狂 8 点！");
  const [pendingEight, setPendingEight] = useState<boolean>(false);

  // Initialize game
  const initGame = useCallback(() => {
    const fullDeck = shuffle(createDeck());
    const playerHand = fullDeck.splice(0, 8);
    const aiHand = fullDeck.splice(0, 8);
    
    // Find a non-8 card for the start of discard pile
    let firstCardIndex = 0;
    while (fullDeck[firstCardIndex].rank === '8') {
      firstCardIndex++;
    }
    const firstCard = fullDeck.splice(firstCardIndex, 1)[0];

    setGameState({
      deck: fullDeck,
      playerHand,
      aiHand,
      discardPile: [firstCard],
      currentSuit: firstCard.suit,
      currentRank: firstCard.rank,
      turn: 'player',
      status: 'playing',
      winner: null,
    });
    setMessage("你的回合！出牌或摸牌。");
    setPendingEight(false);
  }, []);

  useEffect(() => {
    if (gameState.status === 'waiting') {
      initGame();
    }
  }, [gameState.status, initGame]);

  const checkWinner = (state: GameState) => {
    if (state.playerHand.length === 0) return 'player';
    if (state.aiHand.length === 0) return 'ai';
    return null;
  };

  const handleDrawCard = () => {
    if (gameState.status !== 'playing' || gameState.turn !== 'player') return;

    if (gameState.deck.length === 0) {
      setMessage("摸牌堆已空！跳过回合。");
      setTimeout(() => setGameState(prev => ({ ...prev, turn: 'ai' })), 1000);
      return;
    }

    const newDeck = [...gameState.deck];
    const drawnCard = newDeck.pop()!;
    
    setGameState(prev => ({
      ...prev,
      deck: newDeck,
      playerHand: [...prev.playerHand, drawnCard],
      turn: 'ai' // In some rules you can play immediately, but standard is turn ends or you draw until you can play. 
                 // Let's go with: draw one, if playable you can play, if not, turn ends.
                 // Actually, standard Crazy Eights: draw one, if playable play it, else turn ends.
    }));
    setMessage("你摸了一张牌。AI 的回合。");
  };

  const handlePlayCard = (card: Card) => {
    if (gameState.status !== 'playing' || gameState.turn !== 'player') return;

    if (!isPlayable(card, gameState.currentSuit, gameState.currentRank)) {
      setMessage("这张牌不能出！必须匹配花色或点数。");
      return;
    }

    const newPlayerHand = gameState.playerHand.filter(c => c.id !== card.id);
    const newDiscardPile = [...gameState.discardPile, card];

    if (card.rank === '8') {
      setGameState(prev => ({
        ...prev,
        playerHand: newPlayerHand,
        discardPile: newDiscardPile,
        currentRank: card.rank,
        status: 'picking_suit'
      }));
      setPendingEight(true);
      setMessage("万能 8 点！请选择一个新的花色。");
    } else {
      const newState: GameState = {
        ...gameState,
        playerHand: newPlayerHand,
        discardPile: newDiscardPile,
        currentSuit: card.suit,
        currentRank: card.rank,
        turn: 'ai'
      };

      const winner = checkWinner(newState);
      if (winner) {
        setGameState({ ...newState, status: 'game_over', winner });
      } else {
        setGameState(newState);
        setMessage("你出了 " + getSuitSymbol(card.suit) + card.rank + "。AI 的回合。");
      }
    }
  };

  const handleSuitPick = (suit: Suit) => {
    const newState: GameState = {
      ...gameState,
      currentSuit: suit,
      status: 'playing',
      turn: 'ai'
    };
    
    const winner = checkWinner(newState);
    if (winner) {
      setGameState({ ...newState, status: 'game_over', winner });
    } else {
      setGameState(newState);
      setPendingEight(false);
      setMessage("你选择了 " + getSuitSymbol(suit) + "。AI 的回合。");
    }
  };

  // AI Logic
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.turn === 'ai') {
      const timer = setTimeout(() => {
        const playableCards = gameState.aiHand.filter(c => isPlayable(c, gameState.currentSuit, gameState.currentRank));
        
        if (playableCards.length > 0) {
          // AI Strategy: Play non-8 first, prioritize matching rank
          let cardToPlay = playableCards.find(c => c.rank !== '8');
          if (!cardToPlay) cardToPlay = playableCards[0];

          const newAiHand = gameState.aiHand.filter(c => c.id !== cardToPlay!.id);
          const newDiscardPile = [...gameState.discardPile, cardToPlay!];

          if (cardToPlay!.rank === '8') {
            // AI picks its most frequent suit
            const suitCounts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
            newAiHand.forEach(c => suitCounts[c.suit]++);
            const bestSuit = (Object.keys(suitCounts) as Suit[]).reduce((a, b) => suitCounts[a] > suitCounts[b] ? a : b);

            const newState: GameState = {
              ...gameState,
              aiHand: newAiHand,
              discardPile: newDiscardPile,
              currentSuit: bestSuit,
              currentRank: cardToPlay!.rank,
              turn: 'player'
            };
            
            const winner = checkWinner(newState);
            if (winner) {
              setGameState({ ...newState, status: 'game_over', winner });
            } else {
              setGameState(newState);
              setMessage("AI 出了万能 8 点，并选择了 " + getSuitSymbol(bestSuit) + "。你的回合！");
            }
          } else {
            const newState: GameState = {
              ...gameState,
              aiHand: newAiHand,
              discardPile: newDiscardPile,
              currentSuit: cardToPlay!.suit,
              currentRank: cardToPlay!.rank,
              turn: 'player'
            };

            const winner = checkWinner(newState);
            if (winner) {
              setGameState({ ...newState, status: 'game_over', winner });
            } else {
              setGameState(newState);
              setMessage("AI 出了 " + getSuitSymbol(cardToPlay!.suit) + cardToPlay!.rank + "。你的回合！");
            }
          }
        } else {
          // AI must draw
          if (gameState.deck.length > 0) {
            const newDeck = [...gameState.deck];
            const drawnCard = newDeck.pop()!;
            setGameState(prev => ({
              ...prev,
              deck: newDeck,
              aiHand: [...prev.aiHand, drawnCard],
              turn: 'player'
            }));
            setMessage("AI 摸了一张牌。你的回合！");
          } else {
            setGameState(prev => ({ ...prev, turn: 'player' }));
            setMessage("摸牌堆已空！AI 跳过回合。你的回合！");
          }
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState.turn, gameState.status]);

  const topDiscard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen poker-table flex flex-col items-center justify-between p-4 md:p-8 font-sans">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-4">
        <h1 className="text-2xl md:text-4xl font-display font-bold text-emerald-100 tracking-tight">
          Tina<span className="text-yellow-400">疯狂 8 点</span>
        </h1>
        <div className="flex items-center gap-4">
          <div className="bg-black/30 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
            <span className="text-xs uppercase tracking-widest text-emerald-200 font-bold">牌堆: {gameState.deck.length}</span>
          </div>
          <button 
            onClick={() => setGameState(prev => ({ ...prev, status: 'waiting' }))}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* AI Hand */}
      <div className="relative w-full max-w-4xl flex justify-center h-32 md:h-40">
        <div className="flex -space-x-8 md:-space-x-12">
          {gameState.aiHand.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="w-16 h-24 md:w-24 md:h-36 bg-emerald-800 border-2 border-emerald-600 rounded-lg flex items-center justify-center card-shadow"
            >
              <div className="w-12 h-20 md:w-20 md:h-32 border border-emerald-500/30 rounded flex items-center justify-center">
                <div className="text-emerald-500/20 text-4xl font-bold">T</div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
          AI 手牌: {gameState.aiHand.length}
        </div>
      </div>

      {/* Center Board */}
      <div className="flex-1 w-full max-w-4xl flex flex-col items-center justify-center gap-8">
        <div className="flex items-center gap-12 md:gap-20">
          {/* Draw Pile */}
          <div className="relative group cursor-pointer" onClick={handleDrawCard}>
            <div className="w-20 h-28 md:w-28 md:h-40 bg-emerald-900 border-2 border-emerald-700 rounded-xl card-shadow transform -rotate-3 group-hover:rotate-0 transition-transform"></div>
            <div className="absolute inset-0 w-20 h-28 md:w-28 md:h-40 bg-emerald-800 border-2 border-emerald-600 rounded-xl card-shadow flex items-center justify-center">
               <div className="text-emerald-500/40 text-5xl font-bold">?</div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-emerald-300 uppercase tracking-widest">
              点击摸牌
            </div>
          </div>

          {/* Discard Pile */}
          <div className="relative">
            <AnimatePresence mode="popLayout">
              {topDiscard && (
                <motion.div
                  key={topDiscard.id}
                  initial={{ scale: 1.5, opacity: 0, rotate: 45 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  className={`w-20 h-28 md:w-28 md:h-40 bg-white border-2 border-slate-200 rounded-xl card-shadow flex flex-col justify-between p-2 md:p-3 ${getSuitColor(gameState.currentSuit)}`}
                >
                  <div className="flex flex-col leading-none">
                    <span className="text-lg md:text-2xl font-bold">{topDiscard.rank}</span>
                    <span className="text-sm md:text-lg">{getSuitSymbol(topDiscard.suit)}</span>
                  </div>
                  <div className="self-center text-4xl md:text-6xl">
                    {getSuitSymbol(gameState.currentSuit)}
                  </div>
                  <div className="flex flex-col leading-none rotate-180">
                    <span className="text-lg md:text-2xl font-bold">{topDiscard.rank}</span>
                    <span className="text-sm md:text-lg">{getSuitSymbol(topDiscard.suit)}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-emerald-300 uppercase tracking-widest">
              当前: {getSuitSymbol(gameState.currentSuit)} {gameState.currentRank}
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 max-w-md text-center">
          <p className="text-emerald-50 text-sm md:text-base font-medium">{message}</p>
        </div>
      </div>

      {/* Player Hand */}
      <div className="w-full max-w-5xl flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 px-4">
          <AnimatePresence>
            {gameState.playerHand.map((card) => {
              const playable = isPlayable(card, gameState.currentSuit, gameState.currentRank) && gameState.turn === 'player' && gameState.status === 'playing';
              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -100, opacity: 0 }}
                  whileHover={playable ? { y: -20, scale: 1.05 } : {}}
                  onClick={() => handlePlayCard(card)}
                  className={`
                    w-16 h-24 md:w-24 md:h-36 bg-white border-2 rounded-xl card-shadow flex flex-col justify-between p-1.5 md:p-3 cursor-pointer transition-all
                    ${playable ? 'border-yellow-400 ring-4 ring-yellow-400/20' : 'border-slate-200 opacity-80 grayscale-[0.2]'}
                    ${getSuitColor(card.suit)}
                  `}
                >
                  <div className="flex flex-col leading-none">
                    <span className="text-sm md:text-xl font-bold">{card.rank}</span>
                    <span className="text-xs md:text-base">{getSuitSymbol(card.suit)}</span>
                  </div>
                  <div className="self-center text-2xl md:text-4xl">
                    {getSuitSymbol(card.suit)}
                  </div>
                  <div className="flex flex-col leading-none rotate-180">
                    <span className="text-sm md:text-xl font-bold">{card.rank}</span>
                    <span className="text-xs md:text-base">{getSuitSymbol(card.suit)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="bg-emerald-900/50 px-4 py-1 rounded-full text-[10px] font-bold text-emerald-300 uppercase tracking-widest border border-emerald-700/50">
          你的手牌: {gameState.playerHand.length}
        </div>
      </div>

      {/* Suit Picker Modal */}
      <AnimatePresence>
        {gameState.status === 'picking_suit' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
            >
              <h2 className="text-2xl font-display font-bold text-white mb-2">选择新花色</h2>
              <p className="text-slate-400 text-sm mb-8">你打出了 8！现在可以改变游戏的花色。</p>
              <div className="grid grid-cols-2 gap-4">
                {SUITS.map((suit) => (
                  <button
                    key={suit}
                    onClick={() => handleSuitPick(suit)}
                    className={`
                      flex flex-col items-center justify-center p-6 rounded-2xl border transition-all hover:scale-105 active:scale-95
                      ${getSuitColor(suit)} bg-white border-slate-200 hover:border-yellow-400
                    `}
                  >
                    <span className="text-4xl mb-2">{getSuitSymbol(suit)}</span>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-60">{suit}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameState.status === 'game_over' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              className="bg-slate-900 border-2 border-emerald-500/30 p-10 rounded-[2.5rem] max-w-md w-full text-center shadow-[0_0_50px_rgba(16,185,129,0.2)]"
            >
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className={gameState.winner === 'player' ? 'text-yellow-400' : 'text-slate-400'} size={48} />
              </div>
              <h2 className="text-4xl font-display font-bold text-white mb-4">
                {gameState.winner === 'player' ? '你赢了！' : 'AI 赢了！'}
              </h2>
              <p className="text-slate-400 mb-10 leading-relaxed">
                {gameState.winner === 'player' 
                  ? '太棒了！你成功清空了所有手牌，成为了 Tina 疯狂 8 点的冠军。' 
                  : '别灰心！AI 这次运气不错，再来一局挑战它吧。'}
              </p>
              <button
                onClick={initGame}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group"
              >
                <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                重新开始
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Tooltip (Desktop) */}
      <div className="fixed bottom-4 right-4 hidden md:block group">
        <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-slate-900 border border-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
          <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-1">
            <Info size={12} /> 游戏规则
          </h4>
          <ul className="text-[10px] text-slate-300 space-y-1.5 list-disc list-inside">
            <li>匹配弃牌堆顶部的花色或点数。</li>
            <li>数字 <span className="text-yellow-400 font-bold">8</span> 是万能牌，可随时打出。</li>
            <li>打出 8 后可指定新的花色。</li>
            <li>无牌可出时必须摸一张牌。</li>
            <li>最先清空手牌者获胜。</li>
          </ul>
        </div>
        <div className="p-3 bg-white/5 border border-white/10 rounded-full text-emerald-200 cursor-help">
          <Info size={20} />
        </div>
      </div>
    </div>
  );
}
