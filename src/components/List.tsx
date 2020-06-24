import React from 'react';
import { faMusic, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './List.scss';

interface PropsFromApp {
    list: any[];
    index: number;
    selectSong: (name: string, idx: number) => void;
    deleteSong: (name: string) => void;
}
class List extends React.Component<PropsFromApp> {

    private selectList = (name: string, idx: number): void => {
        this.props.selectSong(name, idx);
    }

    render() {
        return (
            <div className="list-container">
                <h1>Music</h1>
                <div className="list-box">
                    <ul className="song-list">
                        { this.props.list.map((item: any, idx: number) => 
                        <li key={ idx } className={ this.props.index === idx ? 'on' : '' } onClick={ () => this.selectList(item.name, idx) }>
                            <span className="thumnail-img"><FontAwesomeIcon icon={ faMusic } size="1x" color="white"/></span>
                            <p className="song-name">
                                { item.name }<br/>
                                <span className="author">Unknown</span>
                            </p>
                            <span onClick={ () => this.props.deleteSong(item.name) }className={ this.props.index === idx ? 'trash-on' : 'trash-off' }><FontAwesomeIcon icon={ faTrashAlt } size="1x" color="white"/></span>
                        </li>)
                        }
                    </ul>
                </div>
            </div>
        );
    }
}

export default List;
