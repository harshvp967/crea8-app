import { defineSignal } from '@temporalio/workflow';

export type SendDocumentEmail = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  addTo: 'top' | 'bottom';
  fullDocument: true;
};

export const sendDocumentEmailSignal =
  defineSignal<[SendDocumentEmail]>('sendDocumentEmail');
