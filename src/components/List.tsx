import React from 'react';
import { faMusic } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './List.scss';

interface PropsFromApp {
    list: any[];
    selectSong: (name: string) => void;
}
class List extends React.Component<PropsFromApp> {

    private selectList = (name: string): void => {
        this.props.selectSong(name);
    }

    render() {
        return (
            <div className="list-container">
                <h1>Music</h1>
                <div className="list-box">
                    <ul className="song-list">
                        { this.props.list.map((item: any, idx: number) => 
                        <li key={ idx } onClick={ () => this.selectList(item.name) }>
                            <span className="thumnail-img"><FontAwesomeIcon icon={ faMusic } size="1x" color="white"/></span>
                            <p className="song-name">
                                { item.name }<br/>
                                <span>Unknown</span>
                            </p>
                        </li>)
                        }
                    </ul>
                </div>
            </div>
        );
    }
}

export default List;
