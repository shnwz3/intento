import React, { useEffect, useState } from 'react';
import useIntentoStore from '../../../store/useIntentoStore';
import styles from './GlobalStatusLoader.module.scss';
import { X } from 'lucide-react';

const GlobalStatusLoader = () => {
    const { globalStatus, clearGlobalStatus } = useIntentoStore();
    const { type, message, subMessage } = globalStatus;
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (type !== 'idle') {
            setIsVisible(true);
            if (type === 'success') {
                const timer = setTimeout(() => {
                    setIsVisible(false);
                    setTimeout(clearGlobalStatus, 400); 
                }, 2500);
                return () => clearTimeout(timer);
            }
        } else {
            setIsVisible(false);
        }
    }, [type, clearGlobalStatus]);

    if (type === 'idle' && !isVisible) return null;

    const renderIcon = () => {
        switch (type) {
            case 'uploading':
                return (
                    <div className={styles.premiumIcon}>
                        <svg viewBox="0 0 100 100" className={styles.svgContainer}>
                            <rect x="30" y="20" width="40" height="60" rx="4" className={styles.docBg} />
                            <path d="M40 35h20M40 45h20M40 55h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={styles.docLines} />
                            <rect x="25" y="15" width="50" height="2" className={styles.scanLine} />
                            <circle cx="50" cy="50" r="45" className={styles.outerRing} strokeDasharray="283" strokeDashoffset="283" />
                        </svg>
                    </div>
                );
            case 'deleting':
                return (
                    <div className={styles.premiumIcon}>
                        <svg viewBox="0 0 100 100" className={styles.svgContainer}>
                            <g className={styles.shatterGroup}>
                                <path d="M30 20 L50 20 L50 50 L30 50 Z" className={styles.shard} />
                                <path d="M50 20 L70 20 L70 50 L50 50 Z" className={styles.shard} />
                                <path d="M30 50 L50 50 L50 80 L30 80 Z" className={styles.shard} />
                                <path d="M50 50 L70 50 L70 80 L50 80 Z" className={styles.shard} />
                            </g>
                            <circle cx="50" cy="50" r="45" className={styles.outerRingDanger} />
                        </svg>
                    </div>
                );
            case 'analyzing':
                return (
                    <div className={styles.premiumIcon}>
                        <svg viewBox="0 0 100 100" className={styles.svgContainer}>
                            <circle cx="50" cy="50" r="10" className={styles.neuralCore} />
                            <g className={styles.neuralNodes}>
                                <circle cx="50" cy="20" r="5" className={styles.node} />
                                <circle cx="80" cy="50" r="5" className={styles.node} />
                                <circle cx="50" cy="80" r="5" className={styles.node} />
                                <circle cx="20" cy="50" r="5" className={styles.node} />
                                <path d="M50 30 L50 40 M70 50 L60 50 M50 70 L50 60 M30 50 L40 50" stroke="currentColor" strokeWidth="1" className={styles.connection} />
                            </g>
                            <circle cx="50" cy="50" r="45" className={styles.orbitRing} />
                        </svg>
                    </div>
                );
            case 'success':
                return (
                    <div className={styles.premiumIcon}>
                        <svg viewBox="0 0 100 100" className={styles.svgContainer}>
                            <circle cx="50" cy="50" r="45" className={styles.successCircle} />
                            <path d="M30 50 L45 65 L70 35" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className={styles.checkPath} />
                        </svg>
                    </div>
                );
            case 'error':
                return (
                    <div className={styles.premiumIcon}>
                        <svg viewBox="0 0 100 100" className={styles.svgContainer}>
                            <circle cx="50" cy="50" r="45" className={styles.errorCircle} />
                            <path d="M35 35 L65 65 M65 35 L35 65" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className={styles.crossPath} />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className={styles.premiumIcon}>
                        <div className={styles.genericLoader} />
                    </div>
                );
        }
    };

    return (
        <div className={`${styles.overlay} ${isVisible ? styles.visible : ''} ${styles[type]}`}>
            <div className={styles.dynamicBackground}>
                <div className={styles.lightLeak} />
            </div>
            
            <div className={styles.glassContainer}>
                <div className={styles.mainGrid}>
                    <div className={styles.visualContainer}>
                        {renderIcon()}
                    </div>
                    
                    <div className={styles.textContainer}>
                        <h1 className={styles.title}>{message}</h1>
                        <p className={styles.subtitle}>{subMessage}</p>
                    </div>
                </div>

                {['uploading', 'deleting', 'analyzing'].includes(type) && (
                    <div className={styles.statusFooter}>
                        <div className={styles.infoRow}>
                            <div className={styles.pulseIndicator} />
                            <span className={styles.statusLabel}>SECURE SYNC ACTIVE</span>
                        </div>
                        <div className={styles.progressTrack}>
                            <div className={styles.progressFill} />
                        </div>
                    </div>
                )}

                {type === 'error' && (
                    <button className={styles.actionBtn} onClick={clearGlobalStatus}>
                        <X size={14} /> <span>DISMISS</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default GlobalStatusLoader;
