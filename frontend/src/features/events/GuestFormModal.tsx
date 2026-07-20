import { useState, type SubmitEvent } from 'react';
import { X } from 'lucide-react';

import { addGuestToEvent } from './api';

import type {
    EventParticipant,
    GameParticipationStatus,
} from "./types"

import styles from './Events.module.css';

interface Props {
    eventId: string;
    onClose: () => void;
    onCreated: (participant: EventParticipant) => void;
}

export default function GeustFormModal({
    eventId, onClose, onCreated
}: Props) {
    const [name, setName] = useState('');
}