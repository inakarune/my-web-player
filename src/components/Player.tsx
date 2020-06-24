import React from 'react';
import { faPlay, faRedo, faReplyAll, faPause, faStepForward, faStepBackward } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Player.scss';

interface PropsFromApp {
    name: string;
    url: string;
    nextSong: (direction: string) => void;
}
class Player extends React.Component<PropsFromApp> {
    private audioRef: any;
    public state = {
        playStatus: 'play-off',
        playBtn: faPlay,
        repeatOnOFF: '#424242',
        time: '00:00',
        width: '0px'
    }

    componentWillReceiveProps(nextProps: any) {// audio play가 promise를 return 하므로 settimeout으로 시간차 재생이 필요.
        if (nextProps.name !== this.props.name) {
            this.setState({ playBtn: faPause, width: '0px', playStatus: 'play-on' });
        }
    }

    private play = (): void => {
        if (!this.audioRef.paused) {
            this.setState({ playBtn: faPlay, playStatus: 'play-off' });
            this.audioRef.pause();
        } else {
            this.setState({ playBtn: faPause, playStatus: 'play-on' });
            this.audioRef.play();
        }
    }

    private repeat = (): void => {
        this.audioRef.loop = !this.audioRef.loop;
        if (this.state.repeatOnOFF === '#ffbf1b') {
            this.setState({ repeatOnOFF: '#424242' });
        } else {
            this.setState({ repeatOnOFF: '#ffbf1b' });
        }
    }

    private timeUpdate = (): void => {
        var hr  = Math.floor(this.audioRef.currentTime / 3600);
        var min: any = Math.floor((this.audioRef.currentTime - (hr * 3600)) / 60);
        var sec: any = Math.floor(this.audioRef.currentTime - (hr * 3600) -  (min * 60));
      
        if (min < 10){ 
          min = "0" + min; 
        }
        if (sec < 10){ 
          sec  = "0" + sec;
        }

        var dhr  = Math.floor(this.audioRef.duration / 3600);
        var dmin: any = Math.floor((this.audioRef.duration - (dhr * 3600)) / 60);
        var dsec: any = Math.floor(this.audioRef.duration - (dhr * 3600) -  (dmin * 60));
      
        if (dmin < 10){ 
          dmin = "0" + dmin; 
        }
        if (dsec < 10){ 
          dsec  = "0" + dsec;
        }

        const total = this.audioRef.duration / 280;
        const now = this.audioRef.currentTime / total;
      
        this.setState({ time: `${ min }:${ sec } | ${ dmin }:${ dsec }`, width: `${ now }px` });
    }

    render(): JSX.Element {
        return (
            <div className="player-box">
                <audio controls src={ this.props.url } ref={ input => this.audioRef = input } className="" autoPlay onTimeUpdate={ this.timeUpdate }></audio>
                <div className="cd"></div>
                <h3>{ this.props.name }</h3>
                
                <div className="progress-box">
                    <div className="progress-value" style={ { width: this.state.width } }></div>
                </div>
                <p className="timeline"><span>{ this.state.time !== '00:00' ? this.state.time.split(' | ')[0] : null }</span><span>{ this.state.time !== '00:00' ? this.state.time.split(' | ')[1] : null }</span></p>
                <div className="player-btn-box">
                    <button title="repeat" onClick={ this.repeat } className="repeat-btn"><FontAwesomeIcon icon={ faRedo } size="1x" color={ this.state.repeatOnOFF } /></button>
                    <button className="backward" onClick={ () => this.props.nextSong('back') } title="play"><FontAwesomeIcon icon={ faStepBackward } size="1x" color="#414141"/></button>
                    <button className={ this.state.playStatus } onClick={ this.play } title="play"><FontAwesomeIcon icon={ this.state.playBtn } size="1x" /></button>
                    <button className="forward" onClick={ () => this.props.nextSong('next') } title="play"><FontAwesomeIcon icon={ faStepForward } size="1x" color="#414141"/></button>
                    <button title="repeat all" className="all-btn"><FontAwesomeIcon icon={ faReplyAll } size="1x" color="#414141" /></button>
                </div>
            </div>
        );
    }
}

export default Player;
